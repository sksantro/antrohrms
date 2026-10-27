# Phase P0 — Platform foundation: acceptance evidence

Date: 27 Oct 2026 · Environment: local dev (Windows, PostgreSQL 17 in Docker, Django 5.2.7, DRF 3.16.1)

## BRD proof points (§20 P0)

| Proof | Result | Evidence |
|---|---|---|
| HR cannot query salaries | Pass | `payroll.tests.CompensationPrivacyTests`; in the browser, HR's request to `/api/v1/admin/compensation/{id}` returned 403 with no salary in the body |
| Admin can create/invite employee | Pass | `employees.tests.InviteEmployeeTests`; in the browser, an employee was created, the invite email was delivered (console backend), the link was activated and the person signed in |

## Delivered

- **Auth:** server-side session in an HttpOnly cookie, CSRF on every write (including login), Argon2 password hashing, generic login error (no account enumeration), rate limits on login and activation, and 401 → login redirect in the UI.
- **Invites:** expiring, single-use activation links. Only the SHA-256 of the token is stored. No temporary passwords are emailed. Consent to the privacy/attendance policy is recorded.
- **Roles:** additive `RoleAssignment` (Super Admin, HR Operations, Employee, Reporting Manager, Interviewer). Only the Super Admin can change roles, and they can't remove their own Super Admin role.
- **Object scope:** employees can read only themselves (others are 404). HR sees operational fields only: no salary, address or emergency contact of others. HR can't edit their own operational fields or employee status.
- **Audit:** append-only `AuditEvent` with actor, before/after, truncated IP and request ID. Salary amounts are not written to the audit log. Super Admin–only read API and screen.
- **Outbox:** `NotificationOutbox` with a dedupe key, delivered after commit, with retry state.
- **Seed:** synthetic organization, office (coordinates left empty for the Super Admin), 18 policy values tagged `REQUIRES_ADMIN_CONFIGURATION` / `REQUIRES_LEGAL_REVIEW` where applicable, 5 departments, and 12 synthetic people with salary versions.
- **Errors:** `{code, message, field_errors, request_id}` on every API error; `X-Request-ID` header on every response.

## Commands run

| Command | Result |
|---|---|
| `manage.py test` | 39 tests, OK |
| `manage.py makemigrations --check` | No changes |
| `manage.py check` | No issues |
| `tsc -b` | No errors |
| `eslint src` | 0 errors, 10 fast-refresh warnings (dev-only) |
| `npm run build` | Built |

## Known gaps (not blockers for P0, tracked for later phases)

- **No Celery yet:** emails are delivered in-process after commit. Celery + Redis workers and retry sweeps are still to come.
- **Email:** uses the console email backend. A real mail domain and SMTP credentials are needed from the owner.
- **Not built yet:** the admin TOTP option, password reset by email, CSV import and the OpenAPI document.
- **No production deployment:** no HTTPS, secret manager or backups configured.
- **Sample data:** attendance, leave, holidays, payslips, payroll, recruitment and assets screens still use sample data and are labelled **Sample data** in the UI.
