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
import type { PolicyCategory, PolicyFormData } from '../../types';
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
  effective_date: new Date().toISOString().slice(0, 10),
  is_active: true,
  policy_file: null,
};

export function PolicyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const basePath = user ? getPoliciesBasePath(user.role) : '/admin/policies';
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
          effective_date: policy.effective_date,
          is_active: policy.is_active,
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
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
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
