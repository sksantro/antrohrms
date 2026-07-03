import secrets
import string


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure random temporary password (plain text returned once only)."""
    alphabet = string.ascii_letters + string.digits + '!@#$%'
    return ''.join(secrets.choice(alphabet) for _ in range(length))
