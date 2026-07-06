import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AddActivityModal } from '../../components/leads/AddActivityModal';
import { DuplicateWarningModal } from '../../components/leads/DuplicateWarningModal';
import { ChangeStatusModal } from '../../components/leads/ChangeStatusModal';
import { CreateLeadModal } from '../../components/leads/CreateLeadModal';
import { EditLeadModal } from '../../components/leads/EditLeadModal';
import {
  buildFilterOptions,
  emptyLeadFilters,
  LeadFiltersBar,
  useDebouncedValue,
} from '../../components/leads/LeadFiltersBar';
import { LeadIcon, PlusIcon } from '../../components/leads/leadIcons';
import { LeadTable } from '../../components/leads/LeadTable';
import { Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useDuplicateWarningModal } from '../../hooks/useDuplicateWarningModal';
import { ApiError } from '../../services/api';
import { isDuplicateWarningError, leadService } from '../../services/leadService';
import type { Lead, LeadActivityFormData, LeadChangeStatusPayload, LeadEditFormData, LeadFilters, LeadFormData } from '../../types/lead';
import { getLeadsBasePath, getLeadsUploadPath } from '../../utils/rbac';

export function LeadListPage() {
  const { user } = useAuth();
  const {
    duplicateConfirmOpen,
    requestDuplicateConfirm,
    closeDuplicateConfirm,
    confirmDuplicate,
  } = useDuplicateWarningModal();
  const basePath = user ? getLeadsBasePath(user.role) : '/employee/leads';
  const uploadPath = user ? getLeadsUploadPath(user.role) : '/employee/leads/upload';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<LeadFilters>(emptyLeadFilters);
  const debouncedSearch = useDebouncedValue(filters.search ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [statusLead, setStatusLead] = useState<Lead | null>(null);
  const [activityLead, setActivityLead] = useState<Lead | null>(null);

  const activeFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const filterOptions = useMemo(() => buildFilterOptions(allLeads), [allLeads]);

  const loadLeads = async (nextFilters = activeFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await leadService.list(nextFilters);
      setLeads(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load leads.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllLeads = async () => {
    try {
      const data = await leadService.list();
      setAllLeads(data);
    } catch {
      setAllLeads([]);
    }
  };

  useEffect(() => {
    void loadAllLeads();
  }, []);

  useEffect(() => {
    void loadLeads(activeFilters);
  }, [activeFilters.status, activeFilters.service_fit, activeFilters.country, activeFilters.industry, activeFilters.priority, activeFilters.lead_owner, activeFilters.date_from, activeFilters.date_to, activeFilters.next_follow_up_from, activeFilters.next_follow_up_to, activeFilters.last_activity_from, activeFilters.last_activity_to, debouncedSearch]);

  const handleCreate = async (data: LeadFormData) => {
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.create(data);
      setIsCreateOpen(false);
      setSuccess('Lead created successfully.');
      await Promise.all([loadLeads(), loadAllLeads()]);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Unable to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (data: LeadEditFormData, confirmDuplicate = false) => {
    if (!editingLead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.update(editingLead.id, data, confirmDuplicate);
      setEditingLead(null);
      setSuccess('Lead updated successfully.');
      await Promise.all([loadLeads(), loadAllLeads()]);
    } catch (err) {
      if (!confirmDuplicate && isDuplicateWarningError(err)) {
        requestDuplicateConfirm(() => void handleEdit(data, true));
        return;
      }
      setModalError(err instanceof ApiError ? err.message : 'Unable to update lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeStatus = async (payload: LeadChangeStatusPayload, confirmDuplicate = false) => {
    if (!statusLead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.changeStatus(statusLead.id, { ...payload, confirm_duplicate: confirmDuplicate });
      setStatusLead(null);
      setSuccess('Lead status updated successfully.');
      await Promise.all([loadLeads(), loadAllLeads()]);
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
    if (!activityLead) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await leadService.createActivity(activityLead.id, { ...data, confirm_duplicate: confirmDuplicate });
      setActivityLead(null);
      setSuccess('Activity added successfully.');
      await loadLeads();
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
                <h2 className="payroll-title">All Leads</h2>
                <p className="payroll-subtitle">
                  Search, filter, and manage your company lead pipeline.
                </p>
              </div>
            </div>
          </div>
          <div className="payroll-header__actions">
            <Link className="payroll-back" to={basePath}>
              Dashboard
            </Link>
            <Link className="payroll-back" to={uploadPath}>
              Bulk Upload
            </Link>
            <Button className="payroll-primary-btn" onClick={() => setIsCreateOpen(true)}>
              <PlusIcon />
              Add Lead
            </Button>
          </div>
        </div>

        <LeadFiltersBar
          filters={filters}
          options={filterOptions}
          showOwnerFilter={user?.role === 'SUPER_ADMIN'}
          onChange={setFilters}
          onReset={() => setFilters(emptyLeadFilters)}
        />

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <div className="lead-table-wrap">
          {isLoading ? (
            <p className="muted">Loading leads...</p>
          ) : (
            <LeadTable
              leads={leads}
              basePath={basePath}
              onEdit={setEditingLead}
              onChangeStatus={setStatusLead}
              onAddActivity={setActivityLead}
            />
          )}
        </div>
      </section>

      <CreateLeadModal
        open={isCreateOpen}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setIsCreateOpen(false);
          setModalError(null);
        }}
        onSubmit={handleCreate}
      />

      <EditLeadModal
        open={Boolean(editingLead)}
        lead={editingLead}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setEditingLead(null);
          setModalError(null);
        }}
        onSubmit={handleEdit}
      />

      <ChangeStatusModal
        open={Boolean(statusLead)}
        lead={statusLead}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setStatusLead(null);
          setModalError(null);
        }}
        onSubmit={handleChangeStatus}
      />

      <AddActivityModal
        open={Boolean(activityLead)}
        lead={activityLead}
        isSubmitting={isSubmitting}
        error={modalError}
        onClose={() => {
          setActivityLead(null);
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
