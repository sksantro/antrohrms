from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.errors import BusinessRuleError
from common.services import audit

from .models import Invite


def me_payload(user) -> dict:
    emp = getattr(user, "employee", None)
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "roles": sorted(user.role_set),
        "employee": None if emp is None else {
            "id": str(emp.id),
            "employee_code": emp.employee_code,
            "designation": emp.designation,
            "department": emp.department.name,
            "status": emp.status,
            "start_date": emp.start_date.isoformat(),
            "probation_end": emp.probation_end.isoformat(),
            "has_direct_reports": emp.direct_reports.exists(),
        },
    }


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the csrftoken cookie so the SPA can send X-CSRFToken on writes."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"ok": True})


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(request, email=s.validated_data["email"].lower(), password=s.validated_data["password"])
        if user is None or not user.is_active:
            # Generic message: no account enumeration (BRD §27.1).
            raise BusinessRuleError("INVALID_CREDENTIALS", "Email or password is incorrect.")
        login(request, user)
        audit(actor=user, action="AUTH_LOGIN", entity=user, request=request, organization=user.organization)
        return Response(me_payload(user))


class LogoutView(APIView):
    def post(self, request):
        audit(actor=request.user, action="AUTH_LOGOUT", entity=request.user, request=request, organization=request.user.organization)
        logout(request)
        return Response(status=204)


class MeView(APIView):
    def get(self, request):
        return Response(me_payload(request.user))


class ActivateSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)
    accept_policy = serializers.BooleanField()


@method_decorator(csrf_protect, name="dispatch")
class ActivateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "activate"

    def _invite(self, token: str) -> Invite:
        invite = Invite.objects.select_related("user").filter(token_hash=Invite.hash(token)).first()
        if invite is None or not invite.is_usable:
            raise BusinessRuleError("INVITE_INVALID", "This invite link has expired or was already used. Ask HR or the Super Admin to send a new one.")
        return invite

    def get(self, request):
        invite = self._invite(request.query_params.get("token", ""))
        return Response({"email": invite.user.email, "display_name": invite.user.display_name, "expires_at": invite.expires_at})

    def post(self, request):
        s = ActivateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        invite = Invite.objects.select_for_update().filter(token_hash=Invite.hash(s.validated_data["token"])).select_related("user").first()
        if invite is None or not invite.is_usable:
            raise BusinessRuleError("INVITE_INVALID", "This invite link has expired or was already used. Ask HR or the Super Admin to send a new one.")
        if not s.validated_data["accept_policy"]:
            raise serializers.ValidationError({"accept_policy": ["Please accept the privacy and attendance policy to continue."]})
        user = invite.user
        try:
            validate_password(s.validated_data["password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)}) from e
        now = timezone.now()
        user.set_password(s.validated_data["password"])
        user.email_verified_at = user.email_verified_at or now
        user.policy_accepted_at = now
        user.save(update_fields=["password", "email_verified_at", "policy_accepted_at"])
        invite.used_at = now
        invite.save(update_fields=["used_at"])
        audit(actor=user, action="AUTH_ACTIVATED", entity=user, request=request, organization=user.organization)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(me_payload(user))
