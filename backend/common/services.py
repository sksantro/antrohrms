"""Cross-cutting services: audit trail and email outbox."""
import logging

from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .middleware import current_request_id
from .models import AuditEvent, NotificationOutbox

log = logging.getLogger(__name__)


def _ip_prefix(request) -> str:
    """Truncate the client IP (BRD §19: IP truncated)."""
    if request is None:
        return ""
    ip = request.META.get("REMOTE_ADDR", "")
    if ":" in ip:
        return ":".join(ip.split(":")[:3]) + "::"
    parts = ip.split(".")
    return ".".join(parts[:3] + ["0"]) if len(parts) == 4 else ""


def audit(*, actor, action: str, entity, before=None, after=None, reason: str = "", request=None, organization=None) -> AuditEvent:
    return AuditEvent.objects.create(
        organization=organization or getattr(entity, "organization", None),
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        # _meta works through request.user's lazy wrapper, where type() would not.
        entity_type=entity._meta.object_name if hasattr(entity, "_meta") else type(entity).__name__,
        entity_id=str(getattr(entity, "pk", "")),
        before=before,
        after=after,
        reason=reason,
        ip_prefix=_ip_prefix(request),
        request_id=current_request_id(),
    )


def queue_email(*, template_key: str, recipient: str, subject: str, body: str, dedupe_key: str, business_ref: str = "", organization=None) -> NotificationOutbox:
    """Idempotent: the same dedupe_key never creates a second email."""
    row, _ = NotificationOutbox.objects.get_or_create(
        dedupe_key=dedupe_key,
        defaults=dict(template_key=template_key, recipient=recipient, subject=subject, body=body, business_ref=business_ref, organization=organization),
    )
    transaction.on_commit(lambda: deliver(row.pk))
    return row


def deliver(outbox_id) -> None:
    """Deliver one outbox row. Celery will call this in a later phase; for now it runs after commit."""
    with transaction.atomic():
        row = NotificationOutbox.objects.select_for_update().filter(pk=outbox_id, status__in=["PENDING", "FAILED"]).first()
        if row is None:
            return
        row.attempts += 1
        try:
            send_mail(row.subject, row.body, None, [row.recipient], fail_silently=False)
            row.status, row.sent_at, row.last_error = "SENT", timezone.now(), ""
        except Exception as exc:  # noqa: BLE001 — record any transport failure and keep the row retryable
            row.status, row.last_error = "FAILED", type(exc).__name__
            log.warning("Email delivery failed for outbox %s", row.pk)
        row.save(update_fields=["status", "sent_at", "attempts", "last_error"])
