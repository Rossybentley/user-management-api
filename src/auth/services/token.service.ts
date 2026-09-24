import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as jwt from 'jsonwebtoken';

export type InvitationTokenPayload = {
  sub: string;
  email: string;
  purpose: 'invitation';
  iat?: number;
  exp?: number;
};

@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

  createInvitationToken(userId: string, email: string): string {
    const secret = this.configService.getOrThrow<string>(
      'INVITATION_JWT_SECRET',
    );

    return jwt.sign(
      {
        sub: userId,
        email,
        purpose: 'invitation',
      },
      secret,
      {
        expiresIn: '24h',
      },
    );
  }

  verifyInvitationToken(token: string): InvitationTokenPayload {
    console.log('Verifying invitation token:', token);
    const secret = this.configService.getOrThrow<string>(
      'INVITATION_JWT_SECRET',
    );

    try {
      const payload = jwt.verify(token, secret) as InvitationTokenPayload;

      if (payload.purpose !== 'invitation') {
        throw new UnauthorizedException('Invalid invitation token');
      }

      return payload;
    } catch (error) {
      console.error('Error verifying invitation token:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired invitation token');
    }
  }
}
