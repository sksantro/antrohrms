export type OnboardingStatus =
  | 'NOT_STARTED'
  | 'INVITED'
  | 'PROFILE_PENDING'
  | 'DOCUMENTS_PENDING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'CORRECTION_REQUIRED';

export type OnboardingDocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'RESUME'
  | 'PHOTO'
  | 'EDUCATION_CERTIFICATE'
  | 'EXPERIENCE_RELIVING';

export type DocumentsStatus = 'Pending' | 'Partial' | 'Complete';

export interface OnboardingDocument {
  id: number;
  document_type: OnboardingDocumentType;
  original_filename: string;
  file_url: string | null;
  uploaded_at: string;
}

export interface OnboardingProfileData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  alternate_phone?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface OnboardingRecord {
  id: number;
  onboarding_id: string;
  employee: number | null;
  employee_code: string | null;
  offer_letter: number | null;
  offer_id: string | null;
  candidate_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joining_date: string;
  employment_type: string;
  work_location: string;
  reporting_manager: number | null;
  reporting_manager_name: string | null;
  status: OnboardingStatus;
  documents_status: DocumentsStatus;
  invite_token: string;
  invite_url: string;
  invited_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  correction_reason: string;
  profile_data: OnboardingProfileData;
  education_details: Record<string, string>[];
  employment_history: Record<string, string>[];
  documents: OnboardingDocument[];
  created_at: string;
  updated_at: string;
}

export interface OnboardingPublic {
  onboarding_id: string;
  candidate_name: string;
  email: string;
  department: string;
  designation: string;
  joining_date: string;
  status: OnboardingStatus;
  documents_status: DocumentsStatus;
  correction_reason: string;
  profile_data: OnboardingProfileData;
  education_details: Record<string, string>[];
  employment_history: Record<string, string>[];
  documents: OnboardingDocument[];
  required_documents: OnboardingDocumentType[];
}

export interface OnboardingFilters {
  search: string;
  status: string;
  department: string;
  designation: string;
  joining_from: string;
  joining_to: string;
}

export interface OnboardingCreatePayload {
  offer_letter_id?: number | null;
  employee_id?: number | null;
  candidate_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  joining_date?: string;
  employment_type?: string;
  work_location?: string;
  reporting_manager_id?: number | null;
}

export const ONBOARDING_STATUS_OPTIONS: { value: OnboardingStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'PROFILE_PENDING', label: 'Profile Pending' },
  { value: 'DOCUMENTS_PENDING', label: 'Documents Pending' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CORRECTION_REQUIRED', label: 'Rejected / Correction Required' },
];

export const ONBOARDING_DOCUMENT_LABELS: Record<OnboardingDocumentType, string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  RESUME: 'Resume',
  PHOTO: 'Photo',
  EDUCATION_CERTIFICATE: 'Education Certificate',
  EXPERIENCE_RELIVING: 'Experience / Relieving Letter',
};

export const REQUIRED_ONBOARDING_DOCUMENTS: OnboardingDocumentType[] = [
  'AADHAAR',
  'PAN',
  'RESUME',
  'PHOTO',
  'EDUCATION_CERTIFICATE',
];

export const emptyOnboardingFilters: OnboardingFilters = {
  search: '',
  status: '',
  department: '',
  designation: '',
  joining_from: '',
  joining_to: '',
};

export const emptyOnboardingCreateForm: OnboardingCreatePayload = {
  offer_letter_id: null,
  employee_id: null,
  candidate_name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  joining_date: '',
  employment_type: 'FULL_TIME',
  work_location: '',
  reporting_manager_id: null,
};

export function formatOnboardingStatus(status: OnboardingStatus): string {
  return ONBOARDING_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}
