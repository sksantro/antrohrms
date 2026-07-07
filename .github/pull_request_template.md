## Staging → Production merge checklist

Complete every item before merging into `production`.

- [ ] **Login works** — tested on staging (login, logout, token refresh, role-based routes)
- [ ] **Backend migrations are okay** — `python manage.py migrate --plan` shows no surprises; CI `makemigrations --check` passes
- [ ] **Frontend build has no error** — `npm run build` passes locally or in CI
- [ ] **No `.env` file pushed** — only `.env.example` is tracked; secrets stay on the server
- [ ] **No unwanted module broken** — smoke-test HR, attendance, payroll, leaves, and sales flows on staging
