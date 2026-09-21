import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';

import { LocalAuthGuard } from './guards/local-auth.guard';

interface AuthenticatedUser {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isDefaultPassword: boolean;
}

interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Request() req: RequestWithUser) {
    const user = req.user;

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isDefaultPassword: user.isDefaultPassword,
      },
    };
  }
}
