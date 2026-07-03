from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHRorSuperAdmin
from settings_app.holiday_import import import_holiday_rows, parse_holiday_upload


class HolidayUploadPreviewView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSuperAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'Please choose a file to upload.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows, warnings, source_type = parse_holiday_upload(uploaded_file)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        valid_count = sum(1 for row in rows if row['is_valid'])
        invalid_count = len(rows) - valid_count

        return Response(
            {
                'source_type': source_type,
                'file_name': uploaded_file.name,
                'rows': rows,
                'summary': {
                    'total': len(rows),
                    'valid': valid_count,
                    'invalid': invalid_count,
                },
                'warnings': warnings,
            },
        )


class HolidayUploadImportView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSuperAdmin]

    def post(self, request):
        rows = request.data.get('rows')
        if not isinstance(rows, list) or not rows:
            return Response({'detail': 'No holiday rows provided for import.'}, status=status.HTTP_400_BAD_REQUEST)

        result = import_holiday_rows(rows)
        return Response(
            {
                'detail': (
                    f"Import complete. Created: {result['created']}, "
                    f"Updated: {result['updated']}, Skipped: {result['skipped']}."
                ),
                **result,
            },
        )
