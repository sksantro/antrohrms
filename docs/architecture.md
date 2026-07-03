# Architecture Overview

## Monorepo layout

Antro HRMS is organized as a monorepo with a Django API backend and a React SPA frontend.

## Backend architecture

- **Framework:** Django + Django REST Framework
- **Database:** PostgreSQL
- **Auth:** JWT via `djangorestframework-simplejwt`
- **Config:** Environment variables via `django-environ`
- **CORS:** `django-cors-headers` for frontend integration

### Modular apps

Each domain module is a separate Django app with its own models, serializers, views, and URLs. This keeps the codebase scalable as HRMS features grow.

### API conventions

- Base path: `/api/`
- Health check: `/api/health/`
- Auth: `/api/auth/token/`, `/api/auth/token/refresh/`
- Module routes: `/api/<module>/`

## Frontend architecture

- **Framework:** React + TypeScript + Vite
- **Routing:** React Router with protected routes
- **State:** Auth context for session and role handling
- **API layer:** Centralized `services/api.ts`

### Folder structure

```
src/
  components/   # Reusable UI components
  pages/        # Route-level pages
  layouts/      # Shared page layouts
  routes/       # Route definitions and guards
  services/     # API client
  hooks/        # Shared React hooks
  utils/        # Helpers
  types/        # TypeScript types
  config/       # Environment configuration
```

## Security baseline

- JWT bearer authentication on protected API endpoints
- Role-based route protection on the frontend
- Environment-based secrets and database configuration
- CORS restricted to configured frontend origins

## Milestone roadmap

1. Foundation + Employee Management
2. Attendance & Leave
3. Payroll Engine
4. Compliance & Reports
5. Payslips
6. Employee Self-Service
