import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, DatePicker, FormSection, Input, Select, Textarea } from '../../components/ui';
import {
  CalendarIcon,
  ChevronLeftIcon,
  DocIcon,
  TextIcon,
  UploadCloudIcon,
} from '../../components/policies/policyIcons';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { PolicyAppliesTo, PolicyCategory, PolicyFormData, PolicyStatus } from '../../types';
import { EMPLOYEE_DEPARTMENTS } from '../../types/employee';
import { formatPolicyCategory, getPoliciesBasePath } from '../../utils/rbac';

const categories: PolicyCategory[] = [
  'LEAVE_POLICY',
  'ATTENDANCE_POLICY',
  'WFH_POLICY',
  'CODE_OF_CONDUCT',
  'DATA_SECURITY',
  'ASSET_USAGE',
  'PAYROLL_POLICY',
  'EXIT_POLICY',
  'PROBATION_POLICY',
  'ANTI_HARASSMENT',
  'OTHER',
];

const emptyForm: PolicyFormData = {
  title: '',
  category: 'LEAVE_POLICY',
  version: '1.0',
  description: '',
  policy_content: '',
  effective_date: new Date().toISOString().slice(0, 10),
  status: 'DRAFT',
  applies_to: 'ALL_EMPLOYEES',
  applies_to_departments: [],
  applies_to_designations: [],
  applies_to_employees: [],
  requires_acknowledgement: true,
  policy_file: null,
};

const statusOptions: Array<{ value: PolicyStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Unpublished' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const appliesToOptions: Array<{ value: PolicyAppliesTo; label: string }> = [
  { value: 'ALL_EMPLOYEES', label: 'All Employees' },
  { value: 'DEPARTMENT', label: 'Department-wise' },
  { value: 'DESIGNATION', label: 'Designation-wise' },
  { value: 'SPECIFIC_EMPLOYEES', label: 'Specific Employees' },
];

export function PolicyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const basePath = user ? getPoliciesBasePath(user.role, user.department) : '/admin/policies';
  const [form, setForm] = useState<PolicyFormData>(emptyForm);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isEdit || !id) return;
      try {
        const policy = await policyService.get(Number(id));
        setForm({
          title: policy.title,
          category: policy.category,
          version: policy.version,
          description: policy.description,
          policy_content: policy.policy_content,
          effective_date: policy.effective_date,
          status: policy.status,
          applies_to: policy.applies_to,
          applies_to_departments: policy.applies_to_departments ?? [],
          applies_to_designations: policy.applies_to_designations ?? [],
          applies_to_employees: policy.applies_to_employees ?? [],
          requires_acknowledgement: policy.requires_acknowledgement,
          policy_file: null,
        });
        setExistingFileUrl(policy.policy_file_url);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load policy.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [id, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !form.policy_file) {
      setError('Policy file is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await policyService.update(Number(id), form);
        navigate(`${basePath}/${id}`);
      } else {
        const created = await policyService.create(form);
        navigate(`${basePath}/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save policy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDepartment = (department: string) => {
    setForm((current) => {
      const exists = current.applies_to_departments.includes(department);
      return {
        ...current,
        applies_to_departments: exists
          ? current.applies_to_departments.filter((item) => item !== department)
          : [...current.applies_to_departments, department],
      };
    });
  };

  const parseNumberList = (value: string): number[] =>
    value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item > 0);

  if (isLoading) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="muted">Loading...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="payroll-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h2 className="payroll-title">{isEdit ? 'Edit Policy' : 'Add Policy'}</h2>
            <p className="payroll-subtitle">Upload and configure a company policy document.</p>
          </div>
          <Link className="payroll-back" to={isEdit && id ? `${basePath}/${id}` : basePath}>
            <ChevronLeftIcon />
            Back
          </Link>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <form className="payroll-form" onSubmit={(e) => void handleSubmit(e)}>
          <FormSection title="Policy Details" icon={<DocIcon />}>
            <div className="form-grid">
              <Input
                id="title"
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <Select
                id="category"
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as PolicyCategory })}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatPolicyCategory(cat)}
                  </option>
                ))}
              </Select>
            </div>
          </FormSection>

          <FormSection title="Effective & Version Control" icon={<CalendarIcon />}>
            <div className="form-grid">
              <Input
                id="version"
                label="Version"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                required
              />
              <DatePicker
                id="effective_date"
                label="Effective Date"
                value={form.effective_date}
                onChange={(value) => setForm({ ...form, effective_date: value })}
                required
              />
              <Select
                id="status"
                label="Status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as PolicyStatus })
                }
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <Select
                id="requires_acknowledgement"
                label="Requires Acknowledgement"
                value={form.requires_acknowledgement ? 'yes' : 'no'}
                onChange={(e) =>
                  setForm({ ...form, requires_acknowledgement: e.target.value === 'yes' })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </div>
          </FormSection>

          <FormSection title="Applies To" icon={<DocIcon />}>
            <div className="form-grid">
              <Select
                id="applies_to"
                label="Target"
                value={form.applies_to}
                onChange={(event) =>
                  setForm({ ...form, applies_to: event.target.value as PolicyAppliesTo })
                }
              >
                {appliesToOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              {form.applies_to === 'DESIGNATION' ? (
                <Input
                  id="applies_to_designations"
                  label="Designations (comma separated)"
                  value={form.applies_to_designations.join(', ')}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      applies_to_designations: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              ) : null}
              {form.applies_to === 'SPECIFIC_EMPLOYEES' ? (
                <Input
                  id="applies_to_employees"
                  label="Employee IDs (comma separated)"
                  value={form.applies_to_employees.join(', ')}
                  onChange={(event) =>
                    setForm({ ...form, applies_to_employees: parseNumberList(event.target.value) })
                  }
                />
              ) : null}
            </div>
            {form.applies_to === 'DEPARTMENT' ? (
              <div className="policy-department-grid">
                {EMPLOYEE_DEPARTMENTS.map((department) => (
                  <label key={department} className="policy-department-chip">
                    <input
                      type="checkbox"
                      checked={form.applies_to_departments.includes(department)}
                      onChange={() => toggleDepartment(department)}
                    />
                    <span>{department}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Document Upload" icon={<UploadCloudIcon size={18} />}>
            <label className="pol-upload">
              <input
                type="file"
                className="pol-upload__input"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setForm({ ...form, policy_file: e.target.files?.[0] ?? null })}
              />
              <span className="pol-upload__icon">
                <UploadCloudIcon />
              </span>
              <span className="pol-upload__text">
                {form.policy_file ? form.policy_file.name : 'Click to upload policy document'}
              </span>
              <span className="pol-upload__hint">
                PDF, DOC, DOCX or TXT{!isEdit ? ' · Required' : ''}
              </span>
            </label>
            {existingFileUrl ? (
              <p className="pol-upload__current">
                Current file:{' '}
                <a href={existingFileUrl} target="_blank" rel="noreferrer">
                  View document
                </a>
              </p>
            ) : null}
          </FormSection>

          <FormSection title="Description" icon={<TextIcon />}>
            <Textarea
              id="description"
              label="Description"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Textarea
              id="policy_content"
              label="Policy Content"
              rows={8}
              value={form.policy_content}
              onChange={(e) => setForm({ ...form, policy_content: e.target.value })}
            />
          </FormSection>

          <div className="payroll-form-actions">
            <Button type="button" variant="secondary" onClick={() => navigate(basePath)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Policy' : 'Create Policy'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
