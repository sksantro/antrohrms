from rest_framework.response import Response
from rest_framework.views import APIView


class AuditLogsPlaceholderView(APIView):
    """Placeholder endpoint for audit logs module."""

    def get(self, request):
        return Response({'detail': 'Audit logs module coming soon.'})
