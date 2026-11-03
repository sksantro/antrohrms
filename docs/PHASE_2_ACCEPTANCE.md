# Phase 2 acceptance — Holidays, Leave, Payroll (3 Nov 2026)

Tests: `python manage.py test` → 123 passing (`leaves/tests.py`, `payroll/tests.py` added). Local end-to-end script covered HR draft → Super Admin publish → 2 optional picks (3rd blocked) → CL request (weekend and chosen holiday not counted) → approval → payroll calculate → approve & lock → employee sees own payslip; HR blocked at every step.

| BRD | Delivered |
|---|---|
| §5.2 Calendar | HR drafts (copy of published), Super Admin publishes or sends back with a note. Revisions supersede; changes shown before publishing. Exactly 4 optional required. |
| §5.3 Optional | Pick 2 of 4, auto-approved; change only before the date; unpicked options stay workdays; never debits leave. |
| §6 Leave | CL/SL/EL only (LOP is a payroll outcome). Quotas from policy `leave.quotas`, pro-rated in the joining year. Weekends/holidays excluded, half day, overlap and attended-day checks, no negative balance, 30-day back-dating (`leave.backdate_days`), probation allowed. Super Admin only decides; reject / send back need a note; past-date approval needs a justification. Append-only ledger; cancel reverses; cancel blocked after start or after payroll lock. Emails on submit and decision. |
| Attendance link | No check-in or WFH request on a holiday or approved full-day leave; half-day leave halves the day's required hours. |
| §8 Payroll | Monthly run from effective-dated salary versions; pro-rata for joiners and unpaid days; Telangana PT slabs; PF/TDS stay off (flagged if switched on without rules); adjustments need a note; negative net blocks approval; approved month locked; payslips visible and emailed only after approval; SHA-256 checksum per slip. Leave and shortfall shown, never auto-deducted. |
| §8.5 Payslip | Employer, period, employee code/name/designation/department/joining, paid/unpaid days, earnings, deductions, gross, total deductions, net (paise). "Download PDF" prints the slip. |

## Holiday Work + Comp-Off (§7), added 3 Nov 2026
| Rule | Where it's enforced | Test |
|---|---|---|
| Only weekly offs, fixed holidays and the person's chosen optional holidays; remote only, no geofence | `leaves/holiday_work.py` `day_label`, `request_work` | `test_only_weekly_offs_and_holidays_are_eligible` |
| Prior Super Admin approval; emergency only for today, starts at once, reviewed after | `request_work`, `start`, `decide` | `test_full_flow_credits_exactly_once`, `test_emergency_starts_now_and_half_day_rules` |
| Start / pause / resume / end with a work summary; a forgotten end can't run past midnight | `start`, `pause`, `stop`, `_close` | `test_full_flow_credits_exactly_once` |
| Hours alone never credit: Super Admin verifies hours (≤ recorded); credit only while the rule is marked legally reviewed | `decide` (`LEGAL_RULE_INACTIVE`), `set_rule` | same |
| ≥ 8 h = 1 day, ≥ 4 h = ½ day (policy `compoff.rule`, editable); ledger posted once, with rule revision, hours, approver, expiry | `CompOffLedger`, constraint `one_grant_per_holiday_work` | same, `test_half_day_credit` |
| Comp-Off used as leave type CO, drawn from grants valid on the dates (earliest expiry first); cancel restores | `consume`, `restore`, `_validate` | `test_use_and_cancel_restores`, `test_expired_comp_off_cannot_be_used` |

Not in this release: leave proof uploads (needs document storage, P3), server-generated PDF files, statutory review of quotas/PT (legal gate).
