import { AggregateRoot, ok, Result } from '@/shared/domain/common';
import { Role } from './role.enum';
import { UserId } from './user.id';
import { UserEmail, UserName, UserPassword } from './value-objects';

export interface UserProps {
  email: UserEmail;
  password: UserPassword;
  name: UserName;
  role: Role;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateUserProps {
  email: UserEmail;
  password: UserPassword;
  name: UserName;
  role?: Role;
}

export class User extends AggregateRoot<UserProps, UserId> {
  private constructor(props: UserProps, id: UserId) {
    super(props, id);
  }

  static create(props: CreateUserProps): Result<User, never> {
    return ok(
      new User(
        {
          email: props.email,
          password: props.password,
          name: props.name,
          role: props.role ?? Role.VIEWER,
          createdAt: new Date(),
          updatedAt: null,
        },
        UserId.generate(),
      ),
    );
  }

  static reconstitute(props: UserProps, id: UserId): User {
    return new User(props, id);
  }

  get email(): UserEmail {
    return this.props.email;
  }

  get password(): UserPassword {
    return this.props.password;
  }

  get name(): UserName {
    return this.props.name;
  }

  get role(): Role {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  changeName(name: UserName): void {
    if (name.equals(this.props.name)) return;

    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  changePassword(password: UserPassword): void {
    this.props.password = password;
    this.props.updatedAt = new Date();
  }

  changeRole(role: Role): void {
    if (role === this.props.role) return;

    this.props.role = role;
    this.props.updatedAt = new Date();
  }

  isAdmin(): boolean {
    return this.props.role === Role.ADMIN;
  }

  isApprover(): boolean {
    return this.props.role === Role.APPROVER || this.props.role === Role.ADMIN;
  }

  isExperimenter(): boolean {
    return this.props.role === Role.EXPERIMENTER || this.props.role === Role.ADMIN;
  }
}
