import {
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { TokenService } from '../auth/services/token.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './enums/user-role.enum';
import { User } from './models/user.model';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Runs automatically when Nest initializes this provider.
   *
   * We use it to make sure the application has its initial
   * Super Admin account.
   */
  async onModuleInit(): Promise<void> {
    await this.seedSuperAdmin();
  }

  /**
   * Find a user by email.
   *
   * Email is normalized before querying so:
   *
   * USER@example.com
   * user@example.com
   *
   * are treated consistently by our application.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  /**
   * Find a user using their primary key.
   *
   * JwtStrategy uses this after extracting the user ID
   * from the JWT "sub" claim.
   */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async updatePassword(user: User, hashedPassword: string): Promise<User> {
    user.password = hashedPassword;
    user.isDefaultPassword = false;

    await user.save();

    return user;
  }
  /**
   * Create a new user.
   *
   * createUserDto = the account we want to create.
   *
   * actor = the currently authenticated user performing
   * the operation.
   */
  async create(
    createUserDto: CreateUserDto,
    actor?: User,
  ): Promise<{
    user: User;
    temporaryPassword: string;
  }> {
    /**
     * If this method was called through our authenticated
     * HTTP endpoint, check what role the actor is allowed
     * to create.
     */
    if (actor) {
      this.validateRoleCreation(actor.role, createUserDto.role);
    }

    const normalizedEmail = createUserDto.email.trim().toLowerCase();

    /**
     * Application-level duplicate check.
     *
     * The database UNIQUE constraint is still our final
     * protection against duplicate emails.
     */
    const existingUser = await this.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    /**
     * Generate a temporary password.
     *
     * Later, our invitation/change-password flow will
     * allow the user to replace this password.
     */
    const temporaryPassword = this.generateTemporaryPassword();

    /**
     * Never store plaintext passwords.
     */
    const hashedPassword = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

    const user = await this.userModel.create({
      firstname: createUserDto.firstname.trim(),
      lastname: createUserDto.lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: createUserDto.role,

      /**
       * Admin-created accounts must change their password
       * before normal login is allowed.
       */
      isDefaultPassword: true,
    });

    const invitationToken = this.tokenService.createInvitationToken(
      user.id,
      user.email,
    );

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    const invitationUrl = `${frontendUrl}/change-password?token=${encodeURIComponent(invitationToken)}`;

    await this.mailService.sendWelcomeEmail(
      user.email,
      user.firstname,
      invitationUrl,
    );
    return {
      user,
      temporaryPassword,
    };
  }

  /**
   * Generate a cryptographically random temporary password.
   */
  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url');
  }

  /**
   * Authorization policy for creating users.
   *
   * SUPER_ADMIN:
   * - can create ADMIN
   * - can create AUTHOR
   *
   * ADMIN:
   * - can create AUTHOR
   * - cannot create ADMIN
   *
   * No one can create another SUPER_ADMIN through
   * POST /users.
   */
  private validateRoleCreation(
    actorRole: UserRole,
    targetRole: UserRole,
  ): void {
    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super Admin accounts cannot be created through this endpoint',
      );
    }

    if (actorRole === UserRole.ADMIN && targetRole === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only a Super Admin can create Admin accounts',
      );
    }
  }

  /**
   * Creates the initial Super Admin when the application
   * starts if the configured account does not already exist.
   */
  private async seedSuperAdmin(): Promise<void> {
    const firstname = this.configService.get<string>('SUPER_ADMIN_FIRSTNAME');

    const lastname = this.configService.get<string>('SUPER_ADMIN_LASTNAME');

    const email = this.configService.get<string>('SUPER_ADMIN_EMAIL');

    const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD');

    if (!firstname || !lastname || !email || !password) {
      throw new Error('Super Admin environment variables are not configured');
    }

    const normalizedEmail = email.trim().toLowerCase();

    /**
     * Makes the seed operation idempotent.
     *
     * Restarting the application won't create another
     * account with the same configured email.
     */
    const existingSuperAdmin = await this.findByEmail(normalizedEmail);

    if (existingSuperAdmin) {
      return;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await this.userModel.create({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,

      /**
       * Bootstrap Super Admin already has an explicit
       * password configured through the environment.
       */
      isDefaultPassword: false,
    });

    console.log('Super Admin seeded successfully');
  }
}
