import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '../../components/PageHeader';
import { Button, ButtonLink, Card, DatePicker, FormSection, Input, Select } from '../../components/ui';
import { ApiError } from '../../services/api';
import { offerLetterService } from '../../services/offerLetterService';
import { onboardingService } from '../../services/onboardingService';
import type { OfferLetter, OnboardingCreatePayload } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { emptyOnboardingCreateForm } from '../../types/onboarding';

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CONSULTANT', label: 'Consultant' },
];

export function OnboardingFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<OnboardingCreatePayload>(emptyOnboardingCreateForm);
  const [acceptedOffers, setAcceptedOffers] = useState<OfferLetter[]>([]);
  const [source, setSource] = useState<'manual' | 'offer'>('manual');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void offerLetterService.list({ status: 'ACCEPTED' }).then(setAcceptedOffers).catch(() => setAcceptedOffers([]));
  }, []);

  const update = (field: keyof OnboardingCreatePayload, value: string | number | null) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleOfferSelect = (offerId: string) => {
    const offer = acceptedOffers.find((item) => String(item.id) === offerId);
    update('offer_letter_id', offer ? offer.id : null);
    if (offer) {
      setForm((current) => ({
        ...current,
        offer_letter_id: offer.id,
        candidate_name: offer.candidate_name,
        email: offer.email,
        phone: offer.phone,
        department: offer.department,
        designation: offer.designation,
        joining_date: offer.joining_date,
        employment_type: offer.employment_type,
        work_location: offer.work_location,
      }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: OnboardingCreatePayload =
        source === 'offer' && form.offer_letter_id
          ? { offer_letter_id: form.offer_letter_id }
          : {
              candidate_name: form.candidate_name,
              email: form.email,
              phone: form.phone,
              department: form.department,
              designation: form.designation,
              joining_date: form.joining_date,
              employment_type: form.employment_type,
              work_location: form.work_location,
            };
      const record = await onboardingService.create(payload);
      navigate(`/hr/onboarding/${record.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create onboarding record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-form-page">
      <Card wide className="onboarding-form-page__card">
        <PageHeader
          title="Create Onboarding"
          description="Start onboarding from an accepted offer or enter candidate details manually."
          actions={
            <ButtonLink to="/hr/onboarding" variant="secondary">
              Back to list
            </ButtonLink>
          }
        />

        {error ? <p className="form-error">{error}</p> : null}

        <form onSubmit={handleSubmit}>
          <FormSection title="Onboarding Source">
            <div className="onboarding-form-page__source">
              <label>
                <input
                  type="radio"
                  name="source"
                  checked={source === 'offer'}
                  onChange={() => setSource('offer')}
                />
                From accepted offer
              </label>
              <label>
                <input
                  type="radio"
                  name="source"
                  checked={source === 'manual'}
                  onChange={() => setSource('manual')}
                />
                Manual candidate details
              </label>
            </div>

            {source === 'offer' ? (
              <Select
                id="onboarding_offer"
                label="Accepted Offer"
                value={form.offer_letter_id ? String(form.offer_letter_id) : ''}
                onChange={(event) => handleOfferSelect(event.target.value)}
                required
              >
                <option value="">Select accepted offer</option>
                {acceptedOffers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.offer_id} — {offer.candidate_name} ({offer.email})
                  </option>
                ))}
              </Select>
            ) : (
              <div className="employee-form-grid">
                <Input
                  id="onboarding_candidate_name"
                  label="Candidate Name"
                  value={form.candidate_name ?? ''}
                  onChange={(event) => update('candidate_name', event.target.value)}
                  required
                />
                <Input
                  id="onboarding_email"
                  label="Email"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(event) => update('email', event.target.value)}
                  required
                />
                <Input
                  id="onboarding_phone"
                  label="Phone"
                  value={form.phone ?? ''}
                  onChange={(event) => update('phone', event.target.value)}
                />
                <Select
                  id="onboarding_department"
                  label="Department"
                  value={form.department ?? ''}
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
                  id="onboarding_designation"
                  label="Designation"
                  value={form.designation ?? ''}
                  onChange={(event) => update('designation', event.target.value)}
                  required
                />
                <DatePicker
                  id="onboarding_joining_date"
                  label="Joining Date"
                  value={form.joining_date ?? ''}
                  onChange={(value) => update('joining_date', value)}
                  required
                />
                <Select
                  id="onboarding_employment_type"
                  label="Employment Type"
                  value={form.employment_type ?? 'FULL_TIME'}
                  onChange={(event) => update('employment_type', event.target.value)}
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <Input
                  id="onboarding_work_location"
                  label="Work Location"
                  value={form.work_location ?? ''}
                  onChange={(event) => update('work_location', event.target.value)}
                />
              </div>
            )}
          </FormSection>

          <div className="employee-form-actions">
            <ButtonLink to="/hr/onboarding" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Onboarding'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
