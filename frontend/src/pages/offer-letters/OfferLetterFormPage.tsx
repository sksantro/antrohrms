import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { OfferLetterTemplate } from '../../components/offer-letters/OfferLetterTemplate';
import { Button, Card, DatePicker, FormSection, Input, Select, Textarea } from '../../components/ui';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import { offerLetterService } from '../../services/offerLetterService';
import type { Employee, OfferLetter, OfferLetterFormData } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { emptyOfferLetterForm } from '../../types/offerLetter';
import { formatEmploymentType } from '../../utils/rbac';

function offerToForm(offer: OfferLetter): OfferLetterFormData {
  return {
    candidate_name: offer.candidate_name,
    email: offer.email,
    phone: offer.phone ?? '',
    department: offer.department,
    designation: offer.designation,
    reporting_manager_id: offer.reporting_manager_id ?? '',
    work_location: offer.work_location ?? '',
    joining_date: offer.joining_date,
    employment_type: offer.employment_type,
    offered_ctc: offer.offered_ctc,
    offer_valid_till: offer.offer_valid_till,
    terms_and_conditions: offer.terms_and_conditions ?? '',
    notes: offer.notes ?? '',
  };
}

export function OfferLetterFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<OfferLetterFormData>(emptyOfferLetterForm);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [previewOffer, setPreviewOffer] = useState<OfferLetter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const employeeList = await employeeService.list();
        setManagers(employeeList);

        if (isEdit && id) {
          const offer = await offerLetterService.get(Number(id));
          setForm(offerToForm(offer));
          setPreviewOffer(offer);
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Unable to load offer letter.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [id, isEdit]);

  const update = (field: keyof OfferLetterFormData, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await offerLetterService.update(Number(id), form);
        navigate(`/hr/offer-letters/${updated.id}`);
      } else {
        const created = await offerLetterService.create(form);
        navigate(`/hr/offer-letters/${created.id}`);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to save offer letter.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updated = await offerLetterService.update(Number(id), form);
        setPreviewOffer(updated);
        setShowPreview(true);
      } else {
        const created = await offerLetterService.create(form);
        setPreviewOffer(created);
        setShowPreview(true);
        navigate(`/hr/offer-letters/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to generate preview.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card wide className="offer-letters-page__card">
        <div className="offer-letters-page__loading">
          <span className="employees-page__loading-spinner" aria-hidden />
          <p>Loading offer letter form...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="offer-letters-page">
      <div className="offer-letter-form-layout">
        <Card wide className="offer-letters-page__card">
          <div className="offer-letter-form-page__header">
            <div>
              <h2>{isEdit ? 'Edit Offer Letter' : 'Create Offer Letter'}</h2>
              <p className="muted">
                Compensation details here are for the offer document only and are not linked to payroll.
              </p>
            </div>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <form
            className="offer-letter-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <FormSection title="Candidate Details">
              <div className="employee-form-grid">
                <Input
                  id="offer_candidate_name"
                  label="Candidate / Employee Name"
                  value={form.candidate_name}
                  onChange={(event) => update('candidate_name', event.target.value)}
                  required
                />
                <Input
                  id="offer_email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  required
                />
                <Input
                  id="offer_phone"
                  label="Phone"
                  value={form.phone}
                  onChange={(event) => update('phone', event.target.value)}
                />
              </div>
            </FormSection>

            <FormSection title="Role Details">
              <div className="employee-form-grid">
                <Select
                  id="offer_department"
                  label="Department"
                  value={form.department}
                  onChange={(event) => update('department', event.target.value)}
                  required
                >
                  <option value="">Select department</option>
                  {EMPLOYEE_DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
                <Input
                  id="offer_designation"
                  label="Designation"
                  value={form.designation}
                  onChange={(event) => update('designation', event.target.value)}
                  required
                />
                <Select
                  id="offer_reporting_manager"
                  label="Reporting Manager"
                  value={String(form.reporting_manager_id)}
                  onChange={(event) =>
                    update('reporting_manager_id', event.target.value ? Number(event.target.value) : '')
                  }
                >
                  <option value="">None</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.employee_code} - {manager.first_name} {manager.last_name}
                    </option>
                  ))}
                </Select>
                <Input
                  id="offer_work_location"
                  label="Work Location"
                  value={form.work_location}
                  onChange={(event) => update('work_location', event.target.value)}
                />
                <DatePicker
                  id="offer_joining_date"
                  label="Joining Date"
                  value={form.joining_date}
                  onChange={(value) => update('joining_date', value)}
                  required
                />
                <Select
                  id="offer_employment_type"
                  label="Employment Type"
                  value={form.employment_type}
                  onChange={(event) => update('employment_type', event.target.value)}
                  required
                >
                  {(['FULL_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT'] as const).map((type) => (
                    <option key={type} value={type}>
                      {formatEmploymentType(type)}
                    </option>
                  ))}
                </Select>
              </div>
            </FormSection>

            <FormSection title="Offer Terms">
              <div className="employee-form-grid">
                <Textarea
                  id="offer_offered_ctc"
                  label="Offered CTC / Compensation Summary"
                  className="employee-form-grid__span-full"
                  value={form.offered_ctc}
                  onChange={(event) => update('offered_ctc', event.target.value)}
                  rows={4}
                  required
                  hint="For offer documentation only. Not linked to payroll or salary structure."
                />
                <DatePicker
                  id="offer_valid_till"
                  label="Offer Valid Till"
                  value={form.offer_valid_till}
                  onChange={(value) => update('offer_valid_till', value)}
                  required
                />
                <Textarea
                  id="offer_terms"
                  label="Additional Terms (Optional)"
                  className="employee-form-grid__span-full"
                  value={form.terms_and_conditions}
                  onChange={(event) => update('terms_and_conditions', event.target.value)}
                  rows={4}
                  hint="Standard Antro employment terms are included automatically. Add extra clauses here if needed."
                />
                <Textarea
                  id="offer_notes"
                  label="Internal Notes"
                  className="employee-form-grid__span-full"
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  rows={3}
                  hint="Visible to HR only. Not included in the candidate offer document."
                />
              </div>
            </FormSection>

            <div className="employee-form-actions">
              <Button type="button" variant="secondary" onClick={() => navigate('/hr/offer-letters')}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => void handlePreview()}>
                Preview
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Offer' : 'Save Draft'}
              </Button>
            </div>
          </form>
        </Card>

        {showPreview && previewOffer?.preview_html ? (
          <Card wide className="offer-letters-page__card offer-letter-preview-card">
            <div className="offer-letter-preview-card__header">
              <h3>Offer Letter Preview</h3>
              <p className="muted">Review the document before sending to the candidate.</p>
            </div>
            <OfferLetterTemplate html={previewOffer.preview_html} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
