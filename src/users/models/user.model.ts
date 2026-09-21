import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  Unique,
} from 'sequelize-typescript';

import { UserRole } from '../enums/user-role.enum';

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare firstname: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare lastname: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare password: string;

  @AllowNull(false)
  @Default(UserRole.AUTHOR)
  @Column(DataType.ENUM(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AUTHOR))
  declare role: UserRole;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isDefaultPassword: boolean;

  declare createdAt: Date;
  declare updatedAt: Date;
}
