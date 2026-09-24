import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/models/user.model';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user: Pick<User, 'role'> }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Admin privileges are required');
    }

    return true;
  }
}
