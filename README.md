# Antro HRMS

Monorepo for the Antro HRMS payroll and human resource management platform.

## Project structure

```
antro-hrms/
├── backend/          # Django REST API
├── frontend/         # React + TypeScript + Vite
└── docs/             # Project documentation
```

## Tech stack

| Layer    | Stack |
|----------|-------|
| Backend  | Django, Django REST Framework, PostgreSQL, JWT |
| Frontend | React, TypeScript, Vite, React Router |

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

## Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Update `.env` with your PostgreSQL credentials and a secure `SECRET_KEY`.

Create the database:

```sql
CREATE DATABASE antro_hrms;
```

For **local development without PostgreSQL**, use SQLite (default in `.env.example`):

```env
DB_ENGINE=sqlite
```

For production, switch to PostgreSQL:

```env
DB_ENGINE=postgresql
DB_NAME=antro_hrms
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432
```

Run migrations and seed demo users:

```bash
python manage.py migrate
python manage.py seed_roles
python manage.py runserver
```

API base URL: `http://localhost:8000/api`

### Health check

```bash
curl http://localhost:8000/api/health/
```

Expected response:

```json
{
  "status": "ok",
  "service": "antro-hrms"
}
```

### Authentication endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Obtain JWT access/refresh tokens and user profile |
| POST | `/api/auth/token/` | Legacy alias for login |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET | `/api/accounts/me/` | Get current authenticated user |
| GET/PATCH | `/api/accounts/me/` | View/update own profile |
| POST | `/api/accounts/me/change-password/` | Change own password |
| GET | `/api/accounts/me/permissions/` | Get role permissions summary |
| GET/POST | `/api/accounts/users/` | List/create users (Super Admin) |
| GET/PATCH | `/api/accounts/users/<id>/` | View/update user (Super Admin) |

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App URL: `http://localhost:5173`

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000/api` |

## Django apps

| App | Purpose |
|-----|---------|
| `accounts` | Authentication and user roles |
| `employees` | Employee master data |
| `attendance` | Attendance tracking |
| `leaves` | Leave management |
| `payroll` | Payroll processing |
| `documents` | Document management |
| `policies` | HR policies |
| `settings_app` | System settings |
| `audit_logs` | Audit trail |

## User roles

- Super Admin
- HR Admin
- Finance Admin
- Employee

## Development notes

- This repository contains base architecture only. Business features will be added milestone by milestone.
- Frontend uses protected routes with role-based access.
- Backend modules are wired with placeholder endpoints and ready for feature development.

## License

Proprietary — Antro HRMS
