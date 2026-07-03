from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = 'Remove inactive user accounts left behind without an employee profile.'

    def handle(self, *args, **options):
        orphans = User.objects.filter(employee_profile__isnull=True, is_active=False)
        count = orphans.count()
        orphans.delete()
        self.stdout.write(self.style.SUCCESS(f'Removed {count} orphaned user account(s).'))
