from django.db.models.signals import post_save
from django.dispatch import receiver

from employees.models import Employee
from policies.services import create_pending_acknowledgements_for_employee


@receiver(post_save, sender=Employee)
def create_policy_acknowledgements_for_new_employee(sender, instance, created, **kwargs):
    if created:
        create_pending_acknowledgements_for_employee(instance)
