"""Uniform error body: {code, message, field_errors, request_id} (BRD §16.1)."""
from rest_framework import exceptions, status
from rest_framework.views import exception_handler as drf_handler

from .middleware import current_request_id


class BusinessRuleError(exceptions.APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "BUSINESS_RULE"

    def __init__(self, code: str, message: str, field_errors: dict[str, list[str]] | None = None):
        super().__init__(detail=message, code=code)
        self.field_errors = field_errors or {}


class ConflictError(BusinessRuleError):
    status_code = status.HTTP_409_CONFLICT


_DEFAULT_CODES = {
    400: ("VALIDATION_ERROR", "Please check the highlighted fields."),
    401: ("NOT_AUTHENTICATED", "Please sign in to continue."),
    403: ("FORBIDDEN", "You don't have access to this."),
    404: ("NOT_FOUND", "We couldn't find that."),
    405: ("METHOD_NOT_ALLOWED", "That action isn't supported here."),
    429: ("RATE_LIMITED", "Too many attempts. Please wait a minute and try again."),
}


def exception_handler(exc, context):
    response = drf_handler(exc, context)
    if response is None:
        return None
    code, message = _DEFAULT_CODES.get(response.status_code, ("ERROR", "Something went wrong."))
    field_errors = {}
    if isinstance(exc, BusinessRuleError):
        code, message, field_errors = exc.get_codes(), str(exc.detail), exc.field_errors
    elif isinstance(exc, exceptions.ValidationError) and isinstance(response.data, dict):
        field_errors = {k: [str(m) for m in (v if isinstance(v, list) else [v])] for k, v in response.data.items() if k != "non_field_errors"}
        nfe = response.data.get("non_field_errors")
        if nfe:
            message = str(nfe[0])
    # 401 vs 403: DRF session auth returns 403 for anonymous; normalise to 401 so the UI can redirect to login.
    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        response.status_code = 401
        code, message = _DEFAULT_CODES[401]
    response.data = {"code": code, "message": message, "field_errors": field_errors, "request_id": current_request_id()}
    return response
