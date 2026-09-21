import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';

import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedSuperAdmin();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  async create(createUserDto: CreateUserDto): Promise<{
    user: User;
    temporaryPassword: string;
  }> {
    const normalizedEmail = createUserDto.email.trim().toLowerCase();

    const existingUser = await this.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const temporaryPassword = this.generateTemporaryPassword();

    const hashedPassword = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

    const user = await this.userModel.create({
      firstname: createUserDto.firstname.trim(),
      lastname: createUserDto.lastname.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: createUserDto.role,
      isDefaultPassword: true,
    });

    return {
      user,
      temporaryPassword,
    };
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64url');
  }

  private async seedSuperAdmin(): Promise<void> {
    const firstname = this.configService.get<string>('SUPER_ADMIN_FIRSTNAME');

    const lastname = this.configService.get<string>('SUPER_ADMIN_LASTNAME');

    const email = this.configService.get<string>('SUPER_ADMIN_EMAIL');

    const password = this.configService.get<string>('SUPER_ADMIN_PASSWORD');

    if (!firstname || !lastname || !email || !password) {
      throw new Error('Super Admin environment variables are not configured');
    }

    const normalizedEmail = email.trim().toLowerCase();

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
      isDefaultPassword: false,
    });

    console.log('Super Admin seeded successfully');
  }
}
