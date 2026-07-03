import { useEffect, useState, type FormEvent } from 'react';

import { Badge, Button, Card, Input, Select, Table, type BadgeVariant } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { CreateUserPayload, User, UserRole } from '../types';
import { formatRole } from '../utils/rbac';

const roles: UserRole[] = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE'];

function getUserInitials(user: User): string {
  const source = (user.full_name || user.email).trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getRoleBadgeVariant(role: UserRole): BadgeVariant {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'info';
    case 'HR_ADMIN':
      return 'accent';
    case 'FINANCE':
      return 'warning';
    case 'MANAGER':
      return 'neutral';
    case 'EMPLOYEE':
    default:
      return 'neutral';
  }
}

function EmptyUsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function UsersPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<CreateUserPayload>({
    email: '',
    full_name: '',
    phone: '',
    role: 'EMPLOYEE',
    password: '',
    is_active: true,
    is_staff: false,
  });

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch {
      setError('Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (can('can_manage_users')) {
      void loadUsers();
    }
  }, [can]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await api.createUser(form);
      setForm({
        email: '',
        full_name: '',
        phone: '',
        role: 'EMPLOYEE',
        password: '',
        is_active: true,
        is_staff: false,
      });
      await loadUsers();
    } catch {
      setError('Unable to create user. Check the form and try again.');
    }
  };

  if (!can('can_manage_users')) {
    return (
      <Card className="users-page-card">
        <h2>Users</h2>
        <p>You do not have permission to manage users.</p>
      </Card>
    );
  }

  return (
    <div className="users-page">
      <Card wide className="users-page-card">
        <div className="users-page-card__header">
          <div>
            <h2 className="users-page-card__title">User Management</h2>
            <p className="users-page-card__subtitle">Create, review, and manage system users</p>
          </div>
          <Badge variant="info">Super Admin only</Badge>
        </div>

        {error ? <p className="form-error users-page-card__error">{error}</p> : null}

        <section className="users-page-form-panel" aria-label="Create user form">
          <div className="users-page-form-panel__header">
            <h3 className="users-page-form-panel__title">Create User</h3>
            <p className="users-page-form-panel__subtitle">Add a new system user with role-based access.</p>
          </div>

          <form className="users-page-form" onSubmit={handleSubmit}>
            <div className="users-page-form__grid">
              <Input
                id="user_email"
                label="Email"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
              <Input
                id="user_full_name"
                label="Full Name"
                placeholder="Enter full name"
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
              <Input
                id="user_phone"
                label="Phone"
                placeholder="Phone number"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
              <Select
                id="user_role"
                label="Role"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </Select>
              <Input
                id="user_password"
                label="Password"
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
                minLength={8}
              />
              <div className="users-page-form__submit">
                <Button type="submit" className="users-page-form__button">
                  Create User
                </Button>
              </div>
            </div>
          </form>
        </section>

        <section className="users-page-table-section" aria-label="Users list">
          <div className="users-page-table-section__header">
            <div>
              <h3 className="users-page-table-section__title">Users</h3>
              <p className="users-page-table-section__subtitle">Review existing system users and access roles.</p>
            </div>
          </div>

          {!isLoading && users.length === 0 ? (
            <div className="users-page-empty">
              <div className="users-page-empty__icon">
                <EmptyUsersIcon />
              </div>
              <p className="users-page-empty__title">No users found</p>
              <p className="users-page-empty__text">Created users will appear here</p>
            </div>
          ) : (
            <Table className="users-page-table-wrap">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="users-page-table__loading">
                      Loading users...
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <span className="users-page-table__primary">{user.email}</span>
                      </td>
                      <td>
                        <div className="users-page-user">
                          <span className="users-page-user__avatar">{getUserInitials(user)}</span>
                          <span className="users-page-user__name">{user.full_name}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={getRoleBadgeVariant(user.role)}>{formatRole(user.role)}</Badge>
                      </td>
                      <td>
                        <Badge variant={user.is_active ? 'success' : 'neutral'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </section>
      </Card>
    </div>
  );
}
