from django.contrib import admin

from leaves.models import LeaveBalance, LeaveRequest

admin.site.register(LeaveBalance)
admin.site.register(LeaveRequest)
