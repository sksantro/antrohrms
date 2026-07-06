import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { DuplicateWarningModal } from '../../components/leads/DuplicateWarningModal';
import { LeadActivityPanel } from '../../components/leads/LeadActivityPanel';
import { AddActivityModal } from '../../components/leads/AddActivityModal';
import { ChangeStatusModal } from '../../components/leads/ChangeStatusModal';
import { ContactFormModal } from '../../components/leads/ContactFormModal';
import { DecisionMakerList } from '../../components/leads/DecisionMakerList';
import { EditLeadModal } from '../../components/leads/EditLeadModal';
import { LeadIcon, PlusIcon } from '../../components/leads/leadIcons';
import { LeadStatusBadge } from '../../components/leads/LeadStatusBadge';
import { StatusChangeHistory } from '../../components/leads/StatusChangeHistory';
import { Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useDuplicateWarningModal } from '../../hooks/useDuplicateWarningModal';
import { ApiError } from '../../services/api';
import { isDuplicateWarningError, leadService } from '../../services/leadService';
import type {
  Lead,
  LeadActivity,
  LeadActivityFormData,
  LeadActivityStatus,
  LeadChangeStatusPayload,
  LeadContact,
  LeadContactFormData,
  LeadEditFormData,
} from '../../types/lead';
import { formatLeadServiceFit, getLeadsListPath } from '../../utils/rbac';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function LeadDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const {
    duplicateConfirmOpen,
    requestDuplicateConfirm,
    closeDuplicateConfirm,
    confirmDuplicate,
  } = useDuplicateWarningModal();
  const listPath = user ? getLeadsListPath(user.role) : '/employee/leads/list';

  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<LeadContact | null>(null);
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  const loadLead = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await leadService.get(Number(id));
      setLead(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load lead.');
      setLead(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLead();
  }, [id]);

  const handleEditLead = async (data: LeadEditFormData, confirmDuplicate = false) => {
    if (!lead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.update(lead.id, data, confirmDuplicate);
      setIsEditLeadOpen(false);
      setSuccess('Lead updated successfully.');
      await loadLead();
    } catch (err) {
      if (!confirmDuplicate && isDuplicateWarningError(err)) {
        requestDuplicateConfirm(() => void handleEditLead(data, true));
        return;
      }
      setModalError(err instanceof ApiError ? err.message : 'Unable to update lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeStatus = async (payload: LeadChangeStatusPayload, confirmDuplicate = false) => {
    if (!lead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.changeStatus(lead.id, { ...payload, confirm_duplicate: confirmDuplicate });
      setIsStatusOpen(false);
      setSuccess('Lead status updated successfully.');
      await loadLead();
    } catch (err) {
      if (!confirmDuplicate && isDuplicateWarningError(err)) {
        requestDuplicateConfirm(() => void handleChangeStatus(payload, true));
        return;
      }
      setModalError(err instanceof ApiError ? err.message : 'Unable to change status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddActivity = async (data: LeadActivityFormData, confirmDuplicate = false) => {
    if (!lead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.createActivity(lead.id, { ...data, confirm_duplicate: confirmDuplicate });
      setIsActivityOpen(false);
      setSuccess('Activity added successfully.');
      await loadLead();
    } catch (err) {
      if (!confirmDuplicate && isDuplicateWarningError(err)) {
        requestDuplicateConfirm(() => void handleAddActivity(data, true));
        return;
      }
      setModalError(err instanceof ApiError ? err.message : 'Unable to add activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateActivity = async (
    activity: LeadActivity,
    status: LeadActivityStatus,
    completionNotes = '',
  ) => {
    if (!lead) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await leadService.updateActivity(lead.id, activity.id, {
        status,
        completion_notes: completionNotes,
      });
      setSuccess(status === 'IN_PROGRESS' ? 'Activity started.' : 'Activity updated successfully.');
      await loadLead();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to update activity.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddContact = async (data: LeadContactFormData) => {
    if (!lead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.createContact(lead.id, data);
      setIsContactModalOpen(false);
      setSuccess('Decision maker added successfully.');
      await loadLead();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Unable to add contact.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateContact = async (data: LeadContactFormData) => {
    if (!lead || !editingContact) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.updateContact(lead.id, editingContact.id, data);
      setEditingContact(null);
      setSuccess('Decision maker updated successfully.');
      await loadLead();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Unable to update contact.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (contact: LeadContact) => {
    if (!lead || !window.confirm(`Remove ${contact.full_name} from this lead?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await leadService.deleteContact(lead.id, contact.id);
      setSuccess('Decision maker removed.');
      await loadLead();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete contact.');
    }
  };

  if (isLoading) {
    return (
      <div className="payroll-page lead-page">
        <section className="payroll-card">
          <p className="muted">Loading lead details...</p>
        </section>
      </div>
    );
  }

  if (error && !lead) {
    return (
      <div className="payroll-page lead-page">
        <section className="payroll-card">
          <p className="form-error">{error}</p>
          <Link className="payroll-back" to={listPath}>
            Back to leads
          </Link>
        </section>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const contacts = lead.contacts ?? [];
  const activities = lead.activities ?? [];
  const statusChanges = lead.status_changes ?? [];

  return (
    <div className="payroll-page lead-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <div className="lead-page__title-row">
              <span className="lead-page__title-icon" aria-hidden>
                <LeadIcon />
              </span>
              <div>
                <h2 className="payroll-title">{lead.company_name}</h2>
                <p className="payroll-subtitle">
                  {lead.industry} · {lead.country}
                </p>
              </div>
            </div>
          </div>
          <div className="payroll-header__actions lead-detail-actions">
            <Link className="payroll-back" to={listPath}>
              Back to leads
            </Link>
            <Button variant="secondary" onClick={() => setIsEditLeadOpen(true)}>
              Edit Lead
            </Button>
            <Button variant="secondary" onClick={() => setIsStatusOpen(true)}>
              Change Status
            </Button>
            <Button className="payroll-primary-btn" onClick={() => setIsActivityOpen(true)}>
              Add Activity
            </Button>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <div className="lead-detail-grid">
          <div className="lead-detail-item">
            <span className="lead-detail-label">Service Fit</span>
            <span className="lead-service-pill">{formatLeadServiceFit(lead.service_fit)}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Status</span>
            <LeadStatusBadge status={lead.current_status} />
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Website</span>
            {lead.website ? (
              <a href={lead.website} target="_blank" rel="noreferrer">
                {lead.website.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Lead Owner</span>
            <span>{lead.lead_owner_name}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Created By</span>
            <span>{lead.created_by_name}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Priority</span>
            <span className="lead-priority-pill">{lead.priority_display}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Company Size</span>
            <span>{lead.company_size || '—'}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Source</span>
            <span>{lead.source || '—'}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Next Follow-up</span>
            <span>{lead.next_follow_up_date ? formatDate(lead.next_follow_up_date) : '—'}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Last Activity</span>
            <span>{lead.last_activity_date ? new Date(lead.last_activity_date).toLocaleString('en-IN') : '—'}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Created Date</span>
            <span>{formatDate(lead.created_at)}</span>
          </div>
          <div className="lead-detail-item">
            <span className="lead-detail-label">Last Updated</span>
            <span>{formatDate(lead.updated_at)}</span>
          </div>
          {lead.last_updated_by_name ? (
            <div className="lead-detail-item">
              <span className="lead-detail-label">Last Updated By</span>
              <span>{lead.last_updated_by_name}</span>
            </div>
          ) : null}
          {lead.remarks ? (
            <div className="lead-detail-item lead-detail-item--full">
              <span className="lead-detail-label">Current Remarks</span>
              <span>{lead.remarks}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="payroll-card lead-contacts-section">
        <div className="payroll-header lead-contacts-section__header">
          <div className="payroll-header__text">
            <h3 className="payroll-title payroll-title--sm">Decision Makers</h3>
            <p className="payroll-subtitle">
              {contacts.length} contact{contacts.length === 1 ? '' : 's'} linked to this company
            </p>
          </div>
          <div className="payroll-header__actions">
            <Button
              className="payroll-primary-btn"
              onClick={() => {
                setEditingContact(null);
                setModalError(null);
                setIsContactModalOpen(true);
              }}
            >
              <PlusIcon />
              Add Contact
            </Button>
          </div>
        </div>

        <DecisionMakerList
          contacts={contacts}
          onEdit={(contact) => {
            setModalError(null);
            setEditingContact(contact);
          }}
          onDelete={(contact) => void handleDeleteContact(contact)}
        />
      </section>

      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h3 className="payroll-title payroll-title--sm">Activities</h3>
            <p className="payroll-subtitle">
              Track pending tasks, due dates, assignments, and completed outreach
            </p>
          </div>
        </div>
        <LeadActivityPanel
          activities={activities}
          isSubmitting={isSubmitting}
          onUpdateStatus={handleUpdateActivity}
        />
      </section>

      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h3 className="payroll-title payroll-title--sm">Status Change History</h3>
            <p className="payroll-subtitle">Pipeline updates and remarks over time</p>
          </div>
        </div>
        <StatusChangeHistory changes={statusChanges} />
      </section>

      <ContactFormModal
        open={isContactModalOpen}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setIsContactModalOpen(false);
          setModalError(null);
        }}
        onSubmit={handleAddContact}
      />

      <ContactFormModal
        open={Boolean(editingContact)}
        contact={editingContact}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setEditingContact(null);
          setModalError(null);
        }}
        onSubmit={handleUpdateContact}
      />

      <EditLeadModal
        open={isEditLeadOpen}
        lead={lead}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setIsEditLeadOpen(false);
          setModalError(null);
        }}
        onSubmit={handleEditLead}
      />

      <ChangeStatusModal
        open={isStatusOpen}
        lead={lead}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setIsStatusOpen(false);
          setModalError(null);
        }}
        onSubmit={handleChangeStatus}
      />

      <AddActivityModal
        open={isActivityOpen}
        lead={lead}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setIsActivityOpen(false);
          setModalError(null);
        }}
        onSubmit={handleAddActivity}
      />

      <DuplicateWarningModal
        open={duplicateConfirmOpen}
        isSubmitting={isSubmitting}
        onClose={closeDuplicateConfirm}
        onConfirm={confirmDuplicate}
      />
    </div>
  );
}
