import type { EmploymentType } from './employee';

export type OfferLetterStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface OfferLetter {
  id: number;
  offer_id: string;
  candidate_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  reporting_manager_id?: number | null;
  reporting_manager_name?: string;
  reporting_manager_display?: string | null;
  work_location: string;
  joining_date: string;
  employment_type: EmploymentType;
  offered_ctc: string;
  offer_valid_till: string;
  terms_and_conditions: string;
  notes: string;
  status: OfferLetterStatus;
  acceptance_token: string;
  acceptance_url?: string;
  sent_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  accepted_document_snapshot?: string;
  preview_html?: string;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

export interface OfferLetterFormData {
  candidate_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  reporting_manager_id: number | '';
  work_location: string;
  joining_date: string;
  employment_type: EmploymentType;
  offered_ctc: string;
  offer_valid_till: string;
  terms_and_conditions: string;
  notes: string;
}

export interface OfferLetterFilters {
  search: string;
  status: OfferLetterStatus | '';
  department: string;
  designation: string;
  created_from: string;
  created_to: string;
}

export interface OfferLetterPublic {
  offer_id: string;
  candidate_name: string;
  email: string;
  department: string;
  designation: string;
  work_location: string;
  joining_date: string;
  employment_type: EmploymentType;
  offered_ctc: string;
  offer_valid_till: string;
  terms_and_conditions: string;
  status: OfferLetterStatus;
  preview_html: string;
  company_name: string;
  can_respond: boolean;
  accepted_at?: string | null;
  rejected_at?: string | null;
}

export interface OfferLetterSendResponse {
  detail: string;
  email_sent: boolean;
  status: OfferLetterStatus;
}

export const OFFER_LETTER_STATUS_OPTIONS: OfferLetterStatus[] = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
];

export const emptyOfferLetterForm: OfferLetterFormData = {
  candidate_name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  reporting_manager_id: '',
  work_location: '',
  joining_date: '',
  employment_type: 'FULL_TIME',
  offered_ctc: '',
  offer_valid_till: '',
  terms_and_conditions: '',
  notes: '',
};

export const emptyOfferLetterFilters: OfferLetterFilters = {
  search: '',
  status: '',
  department: '',
  designation: '',
  created_from: '',
  created_to: '',
};
