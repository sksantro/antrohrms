import uuid

from django.conf import settings
from django.db import models


class SalaryVersion(models.Model):
    """Effective-dated fixed monthly salary. New versions are added; history is never edited (BRD §8.1).

    Confidential: only Super Admin endpoints may serialize this model.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey("employees.Employee", on_delete=models.PROTECT, related_name="salary_versions")
    effective_from = models.DateField()
    monthly_gross = models.DecimalField(max_digits=12, decimal_places=2)
    components = models.JSONField(default=list)  # [{code, name, type, amount}]
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_from"]
        constraints = [models.UniqueConstraint(fields=["employee", "effective_from"], name="uniq_salary_effective_date")]
