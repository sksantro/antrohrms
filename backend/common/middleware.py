import contextvars
import uuid

_request_id = contextvars.ContextVar("request_id", default="")


def current_request_id() -> str:
    return _request_id.get()


class RequestIdMiddleware:
    """Attach a request ID to every request and response for tracing (BRD §19 Observability)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        rid = uuid.uuid4().hex[:16]
        token = _request_id.set(rid)
        request.request_id = rid
        try:
            response = self.get_response(request)
        finally:
            _request_id.reset(token)
        response["X-Request-ID"] = rid
        return response
