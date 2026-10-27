# Phase P1 — Attendance pilot: acceptance evidence

Date: 27 Oct 2026 · Django 5.2.7 / PostgreSQL 17 · 70 backend tests passing

## What's live

| Area | Detail |
|---|---|
| Check-in / breaks / check-out | Server-time punches; state machine NOT_CHECKED_IN → WORKING ⇄ ON_TEA / ON_LUNCH → CHECKED_OUT; unlimited tea; no lunch during tea; check-out during a break closes it |
| Event ledger | `AttendanceEvent` is append-only (save/delete of an existing row raises); totals are rebuilt from events at second precision |
| One open day | DB constraints: one day per person per date, at most one OPEN day per person; mutations lock the employee row |
| Idempotency | Every punch carries `Idempotency-Key`; repeats return current state without a second event |
| Workdays | Monday–Friday from policy; weekend check-in refused with a pointer to Holiday Work (P2) |
| 8h work / 9h presence | Two independent thresholds; check-out short of either needs a reason → `PENDING_REVIEW`; no automatic deduction |
| Previous day left open | Blocks today's check-in until that day is checked out with a reason; employee can request the real time as a correction |
| Geofence | Haversine distance; VERIFIED if distance + accuracy ≤ radius, FAILED if clearly outside, else INCONCLUSIVE. Permission denied / office not configured → INCONCLUSIVE. Never blocks check-in or check-out; non-verified days go to the Super Admin queue |
| Re-verification | Every 15 min while the page is open (logged; never changes time) |
| Location privacy | Coordinates stored only on events; shown only in the Super Admin evidence view; consent screen before the browser prompt |
| Corrections | Employee requests missed check-out / tea resume / lunch resume; Super Admin approves (appends the punch + `CORRECTION_APPROVED`, re-validates the sequence) or rejects; all audited |
| Super Admin | Live board (30 s refresh, ticking timers, break overruns), prioritised exceptions queue, evidence drawer, accept-location / mark-reviewed with required note |
| Office geofence | Policy Center → Office geofence: name, address, lat/long, radius (10–1000 m), "Use my current location"; audited |
| Access | HR, managers and employees get 403 on all admin attendance routes; employees see only their own days |
| Manual onboarding | People returns a copyable single-use invite link (email not configured) |

## Known gaps (later phases or ops)

- **Alerts:** no email or in-app alerts at tea 10/15 or lunch 40/45 minutes. The tracker shows warnings on screen; scheduled alerts need Celery + Redis.
- **Holidays:** holidays and approved leave aren't reflected yet (P2). "Not arrived" includes people on leave.
- **Policy Center:** the attendance and break thresholds are read from policy but can't be edited yet (tabs labelled).
- **Office network proof:** the ACT/Jio network fallback isn't built yet (deployment-dependent).
- **Field testing:** location accuracy on office laptops over both ISPs must be tested on-site (BRD §22.3 UAT).
