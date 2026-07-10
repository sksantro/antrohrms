import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { DocumentsStatusBadge, OnboardingStatusBadge } from '../../components/onboarding/OnboardingStatusBadge';
import { Button, Card, DatePicker, FormSection, Input, Select, Textarea } from '../../components/ui';
import { ApiError } from '../../services/api';
import { onboardingService } from '../../services/onboardingService';
import type { OnboardingProfileData, OnboardingPublic } from '../../types';
import {
  ONBOARDING_DOCUMENT_LABELS,
  REQUIRED_ONBOARDING_DOCUMENTS,
} from '../../types/onboarding';

const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export function OnboardingPortalPage() {
  const { token } = useParams();
  const [record, setRecord] = useState<OnboardingPublic | null>(null);
  const [profile, setProfile] = useState<OnboardingProfileData>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await onboardingService.getPublic(token!);
        setRecord(data);
        setProfile(data.profile_data ?? {});
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load onboarding form.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [token]);

  const handleSaveProfile = async () => {
    if (!token) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await onboardingService.savePublicProfile(token, profile);
      setRecord(updated);
      setSuccess('Profile saved successfully.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (documentType: string, file: File | null) => {
    if (!token || !file) return;
    setUploadingType(documentType);
    setError(null);
    setSuccess(null);
    try {
      const updated = await onboardingService.uploadPublicDocument(token, documentType, file);
      setRecord(updated);
      setSuccess(`${ONBOARDING_DOCUMENT_LABELS[documentType as keyof typeof ONBOARDING_DOCUMENT_LABELS]} uploaded.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to upload document.');
    } finally {
      setUploadingType(null);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!window.confirm('Submit onboarding for HR review? You can still be asked for corrections later.')) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await onboardingService.submitPublic(token);
      setRecord(updated);
      setSuccess('Onboarding submitted for HR review.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit onboarding.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="onboarding-portal-page onboarding-portal-page--loading">
        <Card wide>
          <p>Loading onboarding form...</p>
        </Card>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="onboarding-portal-page">
        <Card wide>
          <p className="form-error">{error}</p>
        </Card>
      </div>
    );
  }

  if (!record) {
    return null;
  }

  const readOnly = record.status === 'COMPLETED' || record.status === 'UNDER_REVIEW' || record.status === 'SUBMITTED';

  return (
    <div className="onboarding-portal-page">
      <Card wide className="onboarding-portal-page__card">
        <div className="onboarding-portal-page__intro">
          <div>
            <h1>Welcome, {record.candidate_name}</h1>
            <p className="muted">
              Complete your onboarding details for {record.designation} · {record.department}
            </p>
          </div>
          <div className="onboarding-portal-page__badges">
            <OnboardingStatusBadge status={record.status} />
            <DocumentsStatusBadge status={record.documents_status} />
          </div>
        </div>

        {record.correction_reason ? (
          <div className="onboarding-portal-page__alert">
            <strong>Correction requested:</strong> {record.correction_reason}
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="onboarding-portal-page__success">{success}</p> : null}

        <FormSection title="Personal Details">
          <div className="employee-form-grid">
            <Input
              id="first_name"
              label="First Name"
              value={profile.first_name ?? ''}
              onChange={(event) => setProfile({ ...profile, first_name: event.target.value })}
              disabled={readOnly}
              required
            />
            <Input
              id="last_name"
              label="Last Name"
              value={profile.last_name ?? ''}
              onChange={(event) => setProfile({ ...profile, last_name: event.target.value })}
              disabled={readOnly}
              required
            />
            <Input
              id="phone"
              label="Phone"
              value={profile.phone ?? ''}
              onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
              disabled={readOnly}
              required
            />
            <Select
              id="gender"
              label="Gender"
              value={profile.gender ?? ''}
              onChange={(event) => setProfile({ ...profile, gender: event.target.value })}
              disabled={readOnly}
              required
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || 'empty'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <DatePicker
              id="date_of_birth"
              label="Date of Birth"
              value={profile.date_of_birth ?? ''}
              onChange={(value) => setProfile({ ...profile, date_of_birth: value })}
              disabled={readOnly}
              required
            />
            <Textarea
              id="address"
              label="Address"
              className="employee-form-grid__span-full"
              value={profile.address ?? ''}
              onChange={(event) => setProfile({ ...profile, address: event.target.value })}
              disabled={readOnly}
              rows={3}
              required
            />
          </div>
        </FormSection>

        <FormSection title="Emergency Contact">
          <div className="employee-form-grid">
            <Input
              id="emergency_contact_name"
              label="Contact Name"
              value={profile.emergency_contact_name ?? ''}
              onChange={(event) => setProfile({ ...profile, emergency_contact_name: event.target.value })}
              disabled={readOnly}
              required
            />
            <Input
              id="emergency_contact_phone"
              label="Contact Phone"
              value={profile.emergency_contact_phone ?? ''}
              onChange={(event) => setProfile({ ...profile, emergency_contact_phone: event.target.value })}
              disabled={readOnly}
              required
            />
          </div>
        </FormSection>

        <FormSection title="Required Documents">
          <div className="onboarding-portal-page__documents">
            {REQUIRED_ONBOARDING_DOCUMENTS.concat(['EXPERIENCE_RELIVING']).map((type) => {
              const uploaded = record.documents.find((doc) => doc.document_type === type);
              const isRequired = REQUIRED_ONBOARDING_DOCUMENTS.includes(type);
              return (
                <div key={type} className="onboarding-portal-page__document">
                  <div>
                    <strong>{ONBOARDING_DOCUMENT_LABELS[type]}</strong>
                    {isRequired ? <span className="onboarding-portal-page__required">Required</span> : null}
                    {uploaded ? (
                      <p className="onboarding-portal-page__uploaded-name">{uploaded.original_filename}</p>
                    ) : null}
                  </div>
                  {!readOnly ? (
                    <label className="onboarding-portal-page__upload">
                      <input
                        type="file"
                        disabled={uploadingType === type}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleUpload(type, file);
                          event.currentTarget.value = '';
                        }}
                      />
                      {uploadingType === type ? 'Uploading...' : uploaded ? 'Replace file' : 'Upload file'}
                    </label>
                  ) : uploaded?.file_url ? (
                    <a href={uploaded.file_url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </FormSection>

        {!readOnly ? (
          <div className="onboarding-portal-page__actions">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => void handleSaveProfile()}>
              {isSaving ? 'Saving...' : 'Save Progress'}
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
              Submit for Review
            </Button>
          </div>
        ) : (
          <p className="onboarding-portal-page__readonly-note">
            This onboarding has been submitted and is currently under HR review.
          </p>
        )}
      </Card>
    </div>
  );
}
