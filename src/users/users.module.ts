import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailModule } from '../mail/mail.module';
import { User } from './models/user.model';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TokenModule } from '../auth/token.module';

@Module({
  imports: [SequelizeModule.forFeature([User]), MailModule, TokenModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
