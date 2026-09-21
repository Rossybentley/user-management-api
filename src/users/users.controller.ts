import { Body, Controller, Post } from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const result = await this.usersService.create(createUserDto);

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
