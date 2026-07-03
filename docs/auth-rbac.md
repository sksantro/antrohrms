# Auth & RBAC

## Roles

| Role | Code | Dashboard |
|------|------|-----------|
| Super Admin | `SUPER_ADMIN` | `/admin/dashboard` |
| HR Admin | `HR_ADMIN` | `/admin/dashboard` |
| Manager | `MANAGER` | `/manager/dashboard` |
| Employee | `EMPLOYEE` | `/employee/dashboard` |
| Finance | `FINANCE` | `/finance/dashboard` |

## User model

Email-based login with fields: `email`, `full_name`, `phone`, `role`, `is_active`, `is_staff`, `date_joined`, `created_at`, `updated_at`.

## Auth APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Login with email + password |
| POST | `/api/auth/logout/` | Blacklist refresh token |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET/PATCH | `/api/auth/me/` | Current user profile |

## Permission classes

- `IsSuperAdmin`
- `IsHRAdmin`
- `IsManager`
- `IsFinance`
- `IsEmployee`
- `IsHRorSuperAdmin`

## Initial super admin

```bash
python manage.py createsuperuser
```

## Dev seed users

```bash
python manage.py seed_roles
```

Password for all seeded users: `Admin@12345`

| Email | Role |
|-------|------|
| superadmin@antro.local | SUPER_ADMIN |
| hr@antro.local | HR_ADMIN |
| manager@antro.local | MANAGER |
| employee@antro.local | EMPLOYEE |
| finance@antro.local | FINANCE |
