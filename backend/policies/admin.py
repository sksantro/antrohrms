from django.contrib import admin

from policies.models import Policy, PolicyAcknowledgement

admin.site.register(Policy)
admin.site.register(PolicyAcknowledgement)
