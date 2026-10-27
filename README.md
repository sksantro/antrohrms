# Antro HRMS

Internal HRMS for Antro-Pai Technology Pvt. Ltd., built from `ANTRO_HRMS_MASTER_BRD.pdf` v1.0.

| Layer | Stack |
|---|---|
| Web | React 19 + TypeScript + Vite + Tailwind + Lucide (`frontend/`) |
| API | Django 5.2 LTS + Django REST Framework (`backend/`) |
| Database | PostgreSQL 17 (Docker, `docker-compose.yml`) |

## First-time setup

```bash
docker compose up -d
```

```bash
python -m venv ~/.virtualenvs/antro-hrms-api
```

```bash
~/.virtualenvs/antro-hrms-api/Scripts/python -m pip install -r backend/requirements.txt
```

Copy `backend/.env.example` to `backend/.env`, then set `DJANGO_SECRET_KEY` and `SEED_DEMO_PASSWORD`.

```bash
~/.virtualenvs/antro-hrms-api/Scripts/python backend/manage.py migrate
```

```bash
~/.virtualenvs/antro-hrms-api/Scripts/python backend/manage.py seed_demo
```

```bash
npm --prefix frontend install
```

## Run

Start the API on port 8000, then the web app on port 5174 (it proxies `/api` to Django):

```bash
~/.virtualenvs/antro-hrms-api/Scripts/python backend/manage.py runserver 127.0.0.1:8000
```

```bash
npm --prefix frontend run dev
```

Open http://localhost:5174 and sign in as any seeded person, e.g. `aarav@antropai.example` (Super Admin) or `riya@antropai.example` (HR), using `SEED_DEMO_PASSWORD` from `backend/.env`. All seeded people are synthetic.

In development, emails (such as invites) are printed to the API server's console instead of being sent.

## Test

```bash
~/.virtualenvs/antro-hrms-api/Scripts/python backend/manage.py test
```

## CI/CD

- `.github/workflows/ci.yml` runs on every push and pull request: Django checks, a migrations check and the tests on PostgreSQL, plus frontend lint and build.
- `.github/workflows/deploy.yml` deploys to the Lightsail server **only on pushes to `production`**.

## Phase status

| Phase | Status |
|---|---|
| **P0 Platform foundation** | Done: see [docs/PHASE_0_ACCEPTANCE.md](docs/PHASE_0_ACCEPTANCE.md) |
| P1 Attendance pilot | UI only, on sample data |
| P2–P5 | UI for several screens on sample data; pages marked **Sample data** in the app |

## Layout

```
backend/
  config/      settings (env-driven), urls
  common/      organization, office site, policy versions, audit log, email outbox, errors, seed_demo
  accounts/    users, roles, invites, login/logout/activate/me, role permissions
  employees/   departments, employee master, directory API, roles API
  payroll/     salary versions (Super Admin only)
frontend/src/
  lib/api.ts   typed API client (session cookie + CSRF)
  lib/auth.tsx session state, roles from the server
  pages/       screens; Login, Activate, People and Audit Trail are live
```
