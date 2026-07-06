from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from leads.bulk_import import (
    build_import_preview,
    build_upload_parse_response,
    create_upload_session,
    execute_import,
    list_import_history,
)
from leads.bulk_upload_serializers import (
    LeadBulkUploadImportRequestSerializer,
    LeadBulkUploadPreviewRequestSerializer,
    LeadImportHistorySerializer,
)
from leads.models import LeadBulkUploadSession
from leads.permissions import LeadPermission, user_can_access_leads


class LeadBulkUploadParseView(APIView):
    permission_classes = [LeadPermission]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'Please choose a file to upload.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = create_upload_session(request.user, uploaded_file)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(build_upload_parse_response(session), status=status.HTTP_201_CREATED)


class LeadBulkUploadPreviewView(APIView):
    permission_classes = [LeadPermission]

    def post(self, request):
        serializer = LeadBulkUploadPreviewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = get_object_or_404(
            LeadBulkUploadSession,
            pk=serializer.validated_data['upload_id'],
            uploaded_by=request.user,
        )

        try:
            preview = build_import_preview(
                session,
                serializer.validated_data['sheet_name'],
                serializer.validated_data['mapping'],
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        response = {**preview}
        response.pop('all_rows', None)
        return Response(response)


class LeadBulkUploadImportView(APIView):
    permission_classes = [LeadPermission]

    def post(self, request):
        serializer = LeadBulkUploadImportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = get_object_or_404(
            LeadBulkUploadSession,
            pk=serializer.validated_data['upload_id'],
            uploaded_by=request.user,
        )

        if not serializer.validated_data['mapping'].get('company_name'):
            return Response(
                {'detail': 'Company Name must be mapped before import.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = execute_import(
                session,
                serializer.validated_data['sheet_name'],
                serializer.validated_data['mapping'],
                skip_duplicates=serializer.validated_data.get('skip_duplicates', True),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'detail': (
                f"Import complete. Imported: {result['imported_rows']}, "
                f"Skipped: {result['skipped_rows']}, Failed: {result['failed_rows']}."
            ),
            **result,
        })


class LeadImportHistoryListView(APIView):
    permission_classes = [LeadPermission]

    def get(self, request):
        if not user_can_access_leads(request.user):
            return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)

        history = list_import_history(request.user)
        serializer = LeadImportHistorySerializer(history, many=True)
        return Response(serializer.data)
