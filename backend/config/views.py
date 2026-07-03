from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Basic health check endpoint for monitoring and load balancers."""
    return Response({
        'status': 'ok',
        'service': 'antro-hrms',
    })
