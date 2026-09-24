import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('MAIL_HOST'),

      port: Number(this.configService.getOrThrow<string>('MAIL_PORT')),

      secure: false,

      auth: {
        user: this.configService.getOrThrow<string>('MAIL_USER'),

        pass: this.configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
    });
  }

  async sendWelcomeEmail(
    email: string,
    firstname: string,
    invitationUrl: string,
  ): Promise<void> {
    const from = this.configService.getOrThrow<string>('MAIL_FROM');

    const info = await this.transporter.sendMail({
      from,
      to: email,
      subject: 'Welcome - Set up your account',

      text: `
Hello ${firstname},

Your account has been created.

Please use the link below to create your password:

${invitationUrl}

This invitation link will expire in 24 hours.

If you were not expecting this invitation, you can ignore this email.
      `.trim(),

      html: `
        <h2>Welcome, ${firstname}</h2>

        <p>Your account has been created.</p>

        <p>
          Use the button below to create your password
          and activate your account.
        </p>

        <p>
          <a href="${invitationUrl}">
            Set your password
          </a>
        </p>

        <p>
          This invitation link will expire in 24 hours.
        </p>

        <p>
          If you were not expecting this invitation,
          you can ignore this email.
        </p>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      console.log(`Email preview: ${previewUrl}`);
    }
  }
}
