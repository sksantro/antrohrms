from django.db import connection
from rest_framework import generics, serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin

from .models import AuditEvent, PolicyVersion


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        with connection.cursor() as c:
            c.execute("SELECT 1")
        return Response({"status": "ok"})


class AuditEventSerializer(serializers.ModelSerializer):
    actor = serializers.CharField(source="actor.display_name", default=None, read_only=True)

    class Meta:
        model = AuditEvent
        fields = ["id", "created_at", "actor", "action", "entity_type", "entity_id", "before", "after", "reason", "ip_prefix", "request_id"]


class AuditListView(generics.ListAPIView):
    """Read-only; there is no update or delete route for audit events."""

    permission_classes = [IsSuperAdmin]
    serializer_class = AuditEventSerializer

    def get_queryset(self):
        qs = AuditEvent.objects.filter(organization=self.request.user.organization).select_related("actor")
        p = self.request.query_params
        if a := p.get("action"):
            qs = qs.filter(action=a)
        if e := p.get("entity_id"):
            qs = qs.filter(entity_id=e)
        return qs


class PolicySerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.display_name", default=None, read_only=True)

    class Meta:
        model = PolicyVersion
        fields = ["id", "key", "value", "status", "effective_from", "created_by", "created_at"]


class PolicyListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = PolicySerializer
    pagination_class = None

    def get_queryset(self):
        return PolicyVersion.objects.filter(organization=self.request.user.organization).select_related("created_by")
