from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import User
from accounts.permissions import IsSuperAdmin
from accounts.serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    ProfileUpdateSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({'detail': 'Logged out successfully.'})


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return UserSerializer
        return ProfileUpdateSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.must_change_password = False
        request.user.save(update_fields=['password', 'must_change_password', 'updated_at'])
        return Response({
            'detail': 'Password updated successfully.',
            'must_change_password': False,
        })


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = (IsSuperAdmin,)
    queryset = User.objects.all().order_by('email')
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsSuperAdmin,)
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer
