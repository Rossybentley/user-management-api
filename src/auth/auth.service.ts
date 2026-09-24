import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { User } from '../users/models/user.model';

import { ChangePasswordDto } from './dto/change-password.dto';
import { TokenService } from './services/token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Validates a user's email and password.
   *
   * This method is called by LocalStrategy during login.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);

    /**
     * We deliberately return the same error whether:
     *
     * 1. The email does not exist
     * 2. The password is incorrect
     *
     * This reduces account-enumeration information.
     */
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    /**
     * Compare the plaintext password supplied during login
     * against the bcrypt hash stored in PostgreSQL.
     *
     * bcrypt does NOT decrypt the stored password.
     */
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    /**
     * Admin-created accounts initially have:
     *
     * isDefaultPassword = true
     *
     * They must use their invitation link to choose
     * their own password before normal login is allowed.
     */
    if (user.isDefaultPassword) {
      throw new UnauthorizedException('Password change required before login');
    }

    return user;
  }

  /**
   * Creates a normal application access token.
   *
   * This is called after successful authentication and
   * after successful initial password setup.
   */
  async login(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    /**
     * Never return:
     *
     * user.password
     * password hashes
     * JWT secrets
     *
     * Only expose safe user information.
     */
    return {
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isDefaultPassword: user.isDefaultPassword,
      },

      accessToken,
    };
  }

  /**
   * Allows an invited user to replace their temporary
   * password with their own password.
   *
   * This endpoint uses an invitation JWT rather than
   * the normal access JWT.
   */
  async changePassword(changePasswordDto: ChangePasswordDto) {
    const { token, newPassword } = changePasswordDto;

    /**
     * Verify:
     *
     * - JWT signature
     * - expiration
     * - purpose === "invitation"
     *
     * TokenService throws UnauthorizedException
     * if verification fails.
     */
    const payload = this.tokenService.verifyInvitationToken(token);

    /**
     * The JWT "sub" claim contains the user's UUID.
     */
    const user = await this.usersService.findById(payload.sub);

    /**
     * The user may have been deleted after the invitation
     * was originally generated.
     */
    if (!user) {
      throw new UnauthorizedException('Invalid invitation token');
    }

    /**
     * Bind the invitation token to the expected account.
     *
     * Even though the JWT signature protects the payload,
     * checking this explicitly makes our intended
     * relationship clear.
     */
    if (user.email.toLowerCase() !== payload.email.toLowerCase()) {
      throw new UnauthorizedException('Invalid invitation token');
    }

    /**
     * Once the user has successfully chosen their password,
     * isDefaultPassword becomes false.
     *
     * This prevents the same invitation from being used
     * again afterward.
     */
    if (!user.isDefaultPassword) {
      throw new BadRequestException('This invitation has already been used');
    }

    /**
     * Hash the new password before it goes anywhere
     * near PostgreSQL.
     */
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    /**
     * UsersService performs the database update:
     *
     * password = new bcrypt hash
     * isDefaultPassword = false
     */
    const updatedUser = await this.usersService.updatePassword(
      user,
      hashedPassword,
    );

    /**
     * After successful password setup we immediately issue
     * a normal application access token.
     *
     * This means the user is authenticated without needing
     * to enter the same password again immediately.
     */
    return this.login(updatedUser);
  }
}
