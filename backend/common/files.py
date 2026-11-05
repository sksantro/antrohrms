"""Upload checks: size limit and type sniffed from the content, never trusted from the browser."""
import hashlib
import re
import zipfile
from io import BytesIO

from django.http import HttpResponse

from .errors import BusinessRuleError
from .models import StoredFile

MAX_BYTES = 5 * 1024 * 1024
KINDS = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "png": "image/png", "jpg": "image/jpeg"}


def sniff(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"PK\x03\x04"):
        try:
            names = zipfile.ZipFile(BytesIO(data)).namelist()
        except zipfile.BadZipFile:
            return None
        return "docx" if "word/document.xml" in names else None
    return None


def store(upload, org, actor, allowed=("pdf", "docx", "png", "jpg")) -> StoredFile:
    if upload is None:
        raise BusinessRuleError("FILE_REQUIRED", "Choose a file.")
    if upload.size > MAX_BYTES:
        raise BusinessRuleError("FILE_TOO_LARGE", "Files can be up to 5 MB.")
    data = upload.read()
    kind = sniff(data)
    if kind not in allowed:
        raise BusinessRuleError("FILE_TYPE", f"Upload a {', '.join(k.upper() for k in allowed)} file.")
    stem = re.sub(r"[^\w .-]", "_", (upload.name or "file").rsplit(".", 1)[0])[:150] or "file"
    return StoredFile.objects.create(organization=org, name=f"{stem}.{kind}", mime=KINDS[kind], size=len(data),
                                     sha256=hashlib.sha256(data).hexdigest(), data=data, uploaded_by=actor if getattr(actor, "is_authenticated", False) else None)


def serve(f: StoredFile) -> HttpResponse:
    r = HttpResponse(bytes(f.data), content_type=f.mime)
    r["Content-Disposition"] = f'attachment; filename="{f.name}"'
    r["X-Content-Type-Options"] = "nosniff"
    r["Cache-Control"] = "private, no-store"
    return r
