from rest_framework.response import Response
from rest_framework.views import APIView


class DocumentsPlaceholderView(APIView):
    """Placeholder endpoint for documents module."""

    def get(self, request):
        return Response({'detail': 'Documents module coming soon.'})
