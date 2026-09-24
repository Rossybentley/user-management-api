import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';

import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateUserDto } from './dto/create-user.dto';
import { User } from './models/user.model';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: ExpressRequest & { user: User },
  ) {
    const result = await this.usersService.create(createUserDto, req.user);

    return {
      message: 'User created successfully',
      user: {
        id: result.user.id,
        firstname: result.user.firstname,
        lastname: result.user.lastname,
        email: result.user.email,
        role: result.user.role,
        isDefaultPassword: result.user.isDefaultPassword,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
    };
  }
}
