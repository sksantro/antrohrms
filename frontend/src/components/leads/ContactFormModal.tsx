import { useEffect, useState } from 'react';

import { Button, Input, Modal, Textarea } from '../ui';
import type { LeadContact, LeadContactFormData } from '../../types/lead';
import { emptyLeadContactForm } from '../../types/lead';
import { LeadIcon } from './leadIcons';

interface ContactFormModalProps {
  open: boolean;
  contact?: LeadContact | null;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: LeadContactFormData) => Promise<void>;
}

function contactToForm(contact: LeadContact): LeadContactFormData {
  return {
    full_name: contact.full_name,
    designation: contact.designation,
    department: contact.department,
    linkedin_profile_url: contact.linkedin_profile_url,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    remarks: contact.remarks,
  };
}

function validateContactForm(form: LeadContactFormData): string | null {
  if (!form.full_name.trim()) return 'Full name is required.';
  if (!form.designation.trim()) return 'Designation is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (form.linkedin_profile_url.trim() && !/^https?:\/\/.+/i.test(form.linkedin_profile_url.trim())) {
    return 'LinkedIn URL must start with http:// or https://';
  }
  return null;
}

export function ContactFormModal({
  open,
  contact,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: ContactFormModalProps) {
  const isEdit = Boolean(contact);
  const [form, setForm] = useState<LeadContactFormData>(
    contact ? contactToForm(contact) : emptyLeadContactForm,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(contact ? contactToForm(contact) : emptyLeadContactForm);
      setLocalError(null);
    }
  }, [open, contact]);

  const update = (field: keyof LeadContactFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setForm(emptyLeadContactForm);
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const validationError = validateContactForm(form);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    await onSubmit(form);
    setForm(emptyLeadContactForm);
  };

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Decision Maker' : 'Add Decision Maker'}
      subtitle="Capture key contact details for this company lead."
      icon={<LeadIcon />}
      size="lg"
      className="lead-modal"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Contact' : 'Add Contact'}
          </Button>
        </>
      }
    >
      {localError || error ? <p className="form-error">{localError ?? error}</p> : null}

      <div className="lead-form-grid">
        <Input
          id="contact_full_name"
          label="Full Name"
          value={form.full_name}
          onChange={(e) => update('full_name', e.target.value)}
          required
        />
        <Input
          id="contact_designation"
          label="Designation"
          value={form.designation}
          onChange={(e) => update('designation', e.target.value)}
          required
        />
        <Input
          id="contact_department"
          label="Department"
          value={form.department}
          onChange={(e) => update('department', e.target.value)}
        />
        <Input
          id="contact_location"
          label="Location"
          value={form.location}
          onChange={(e) => update('location', e.target.value)}
        />
        <Input
          id="contact_email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <Input
          id="contact_phone"
          label="Phone"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
        <Input
          id="contact_linkedin"
          label="LinkedIn Profile URL"
          type="url"
          placeholder="https://linkedin.com/in/..."
          value={form.linkedin_profile_url}
          onChange={(e) => update('linkedin_profile_url', e.target.value)}
          className="lead-form-grid__span-full"
        />
        <Textarea
          id="contact_remarks"
          label="Remarks"
          className="lead-form-grid__span-full"
          value={form.remarks}
          onChange={(e) => update('remarks', e.target.value)}
          rows={3}
          placeholder="Notes about this decision maker..."
        />
      </div>
    </Modal>
  );
}
