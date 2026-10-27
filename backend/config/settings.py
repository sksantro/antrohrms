"""Antro HRMS settings. All environment-specific values come from env vars (BRD §22.1)."""
import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_dotenv(BASE_DIR / ".env")


def env(key: str, default: str | None = None, *, legacy: str | None = None) -> str:
    """Read an env var; `legacy` is the name the previous deployment's .env used for the same value."""
    val = os.environ.get(key)
    if val is None and legacy:
        val = os.environ.get(legacy)
    if val is None:
        val = default
    if val is None:
        raise RuntimeError(f"Missing required environment variable {key}")
    return val


def env_bool(key: str, default: bool = False, *, legacy: str | None = None) -> bool:
    return env(key, str(default), legacy=legacy).lower() in {"1", "true", "yes"}


def env_list(key: str, default: str = "", *, legacy: str | None = None) -> list[str]:
    return [x.strip() for x in env(key, default, legacy=legacy).split(",") if x.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", legacy="SECRET_KEY")
DEBUG = env_bool("DJANGO_DEBUG", False, legacy="DEBUG")
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", legacy="CORS_ALLOWED_ORIGINS")
# Only needed when the web app is served from a different origin than the API.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
WEB_BASE_URL = env("WEB_BASE_URL", "http://localhost:5174")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "common",
    "accounts",
    "employees",
    "payroll",
]

MIDDLEWARE = [
    "common.middleware.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"

# DATABASE_URL is preferred; DB_ENGINE/DB_* is what the previous server .env used.
if os.environ.get("DATABASE_URL"):
    _db = urlparse(env("DATABASE_URL"))
    _default = {"ENGINE": "django.db.backends.postgresql", "NAME": _db.path.lstrip("/"), "USER": _db.username,
                "PASSWORD": _db.password, "HOST": _db.hostname, "PORT": _db.port or 5432}
elif env("DB_ENGINE", "") == "postgresql":
    _default = {"ENGINE": "django.db.backends.postgresql", "NAME": env("DB_NAME", "antro_hrms"), "USER": env("DB_USER", "postgres"),
                "PASSWORD": env("DB_PASSWORD", ""), "HOST": env("DB_HOST", "localhost"), "PORT": env("DB_PORT", "5432")}
else:
    # New file name so an old db.sqlite3 from the previous app is never reused.
    _default = {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "hrms.sqlite3"}
DATABASES = {"default": {**_default, "ATOMIC_REQUESTS": True}}

AUTH_USER_MODEL = "accounts.User"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Server-side session in HttpOnly cookie + CSRF (BRD §0.4). No tokens in localStorage.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
# Secure cookies need HTTPS. Set COOKIE_SECURE=false only for a temporary plain-HTTP server.
SESSION_COOKIE_SECURE = env_bool("COOKIE_SECURE", not DEBUG)
SESSION_COOKIE_AGE = 60 * 60 * 10
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "common.errors.exception_handler",
    "DEFAULT_THROTTLE_RATES": {"login": "10/min", "activate": "10/min"},
    "COERCE_DECIMAL_TO_STRING": True,
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env("EMAIL_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_PASSWORD", "")
EMAIL_USE_TLS = True
DEFAULT_FROM_EMAIL = env("EMAIL_FROM_ADDRESS", "Antro HRMS <no-reply@antropai.example>")

INVITE_TTL_HOURS = int(env("INVITE_TTL_HOURS", "72"))

LANGUAGE_CODE = "en-in"
TIME_ZONE = env("DEFAULT_TIMEZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
