import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { Badge, Button, Input, Modal, Select, Table, TableEmpty, Textarea, Toast } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { settingsService } from '../../services/settingsService';
import type {
  CompanyHoliday,
  CompanyHolidayPayload,
  DepartmentMaster,
  DesignationMaster,
  HolidayType,
  LeaveTypeMaster,
  PolicyCategoryMaster,
} from '../../types';
import { HOLIDAY_TYPE_OPTIONS, formatHolidayType } from '../../types/settings';

type MasterSection =
  | 'departments'
  | 'designations'
  | 'leave-types'
  | 'holidays'
  | 'policy-categories'
  | 'document-templates';

type ConfirmState =
  | { kind: 'department'; id: number; name: string; activate: boolean }
  | { kind: 'designation'; id: number; name: string; activate: boolean }
  | { kind: 'leave-type'; id: number; name: string; activate: boolean }
  | { kind: 'policy-category'; id: number; name: string; activate: boolean }
  | { kind: 'holiday'; id: number; name: string }
  | null;

const SECTION_ITEMS: Array<{ id: MasterSection; title: string; description: string }> = [
  {
    id: 'departments',
    title: 'Departments',
    description: 'Organize employees into departments used across HR workflows.',
  },
  {
    id: 'designations',
    title: 'Designations',
    description: 'Maintain job titles and optionally link them to a department.',
  },
  {
    id: 'leave-types',
    title: 'Leave Types',
    description: 'Configure leave categories, annual quota, and paid/unpaid flags.',
  },
  {
    id: 'holidays',
    title: 'Holiday List',
    description: 'Manage national, company, and optional holidays.',
  },
  {
    id: 'policy-categories',
    title: 'Policy Categories',
    description: 'Categories used when creating and filtering company policies.',
  },
  {
    id: 'document-templates',
    title: 'Document Templates',
    description: 'Offer, appointment, NDA, and joining form templates.',
  },
];

const DOCUMENT_TEMPLATES = [
  { name: 'Offer Letter Template', status: 'Available via Offer Letters' },
  { name: 'Appointment Letter Template', status: 'Coming Soon' },
  { name: 'NDA Template', status: 'Coming Soon' },
  { name: 'Joining Form Template', status: 'Coming Soon' },
];

function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>;
}

export function HRCompanySettingsPage() {
  const { can } = useAuth();
  const canManage = can('can_manage_hr_company_settings');

  const [activeSection, setActiveSection] = useState<MasterSection>('departments');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [designations, setDesignations] = useState<DesignationMaster[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeMaster[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [categories, setCategories] = useState<PolicyCategoryMaster[]>([]);

  const [deptForm, setDeptForm] = useState({ id: 0, name: '', description: '' });
  const [desigForm, setDesigForm] = useState({
    id: 0,
    name: '',
    department: '' as string | number,
    description: '',
  });
  const [leaveForm, setLeaveForm] = useState({
    id: 0,
    code: '',
    name: '',
    annual_quota: '0',
    is_paid: true,
    description: '',
  });
  const [holidayForm, setHolidayForm] = useState<CompanyHolidayPayload & { id: number }>({
    id: 0,
    name: '',
    date: '',
    holiday_type: 'COMPANY_HOLIDAY',
    description: '',
  });
  const [categoryForm, setCategoryForm] = useState({
    id: 0,
    code: '',
    name: '',
    description: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [deptList, desigList, leaveList, holidayList, categoryList] = await Promise.all([
        settingsService.listDepartments(),
        settingsService.listDesignations(),
        settingsService.listLeaveTypes(),
        settingsService.listHolidays(undefined, { active: false }),
        settingsService.listPolicyCategories(),
      ]);
      setDepartments(deptList);
      setDesignations(desigList);
      setLeaveTypes(leaveList);
      setHolidays(holidayList);
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load HR settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const matchesSearch = (value: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return value.toLowerCase().includes(q);
  };

  const filteredDepartments = useMemo(
    () => departments.filter((item) => matchesSearch(`${item.name} ${item.description}`)),
    [departments, search],
  );
  const filteredDesignations = useMemo(
    () =>
      designations.filter((item) =>
        matchesSearch(`${item.name} ${item.department_name ?? ''} ${item.description}`),
      ),
    [designations, search],
  );
  const filteredLeaveTypes = useMemo(
    () => leaveTypes.filter((item) => matchesSearch(`${item.name} ${item.code} ${item.description}`)),
    [leaveTypes, search],
  );
  const filteredHolidays = useMemo(
    () =>
      holidays.filter((item) =>
        matchesSearch(`${item.name} ${item.holiday_type} ${item.description}`),
      ),
    [holidays, search],
  );
  const filteredCategories = useMemo(
    () => categories.filter((item) => matchesSearch(`${item.name} ${item.code} ${item.description}`)),
    [categories, search],
  );

  const activeDepartments = useMemo(
    () => departments.filter((item) => item.is_active),
    [departments],
  );

  const resetForms = () => {
    setDeptForm({ id: 0, name: '', description: '' });
    setDesigForm({ id: 0, name: '', department: '', description: '' });
    setLeaveForm({ id: 0, code: '', name: '', annual_quota: '0', is_paid: true, description: '' });
    setHolidayForm({
      id: 0,
      name: '',
      date: '',
      holiday_type: 'COMPANY_HOLIDAY',
      description: '',
    });
    setCategoryForm({ id: 0, code: '', name: '', description: '' });
  };

  const runSave = async (action: () => Promise<unknown>, successMessage: string) => {
    if (!canManage) return;
    setIsSaving(true);
    setError(null);
    try {
      await action();
      setToast({ message: successMessage, type: 'success' });
      resetForms();
      await loadData();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to save changes.';
      setError(message);
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDepartmentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: deptForm.name.trim(),
      description: deptForm.description.trim(),
    };
    if (!payload.name) {
      setError('Department name is required.');
      return;
    }
    if (deptForm.id) {
      await runSave(
        () => settingsService.updateDepartment(deptForm.id, payload),
        'Department updated successfully.',
      );
    } else {
      await runSave(
        () => settingsService.createDepartment(payload),
        'Department added successfully.',
      );
    }
  };

  const handleDesignationSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: desigForm.name.trim(),
      description: desigForm.description.trim(),
      department: desigForm.department === '' ? null : Number(desigForm.department),
    };
    if (!payload.name) {
      setError('Designation name is required.');
      return;
    }
    if (desigForm.id) {
      await runSave(
        () => settingsService.updateDesignation(desigForm.id, payload),
        'Designation updated successfully.',
      );
    } else {
      await runSave(
        () => settingsService.createDesignation(payload),
        'Designation added successfully.',
      );
    }
  };

  const handleLeaveTypeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      code: leaveForm.code.trim().toUpperCase().replace(/\s+/g, '_'),
      name: leaveForm.name.trim(),
      annual_quota: leaveForm.annual_quota || '0',
      is_paid: leaveForm.is_paid,
      description: leaveForm.description.trim(),
    };
    if (!payload.code || !payload.name) {
      setError('Leave type code and name are required.');
      return;
    }
    if (leaveForm.id) {
      await runSave(
        () => settingsService.updateLeaveType(leaveForm.id, payload),
        'Leave type updated successfully.',
      );
    } else {
      await runSave(
        () => settingsService.createLeaveType(payload),
        'Leave type added successfully.',
      );
    }
  };

  const handleHolidaySubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload: CompanyHolidayPayload = {
      name: holidayForm.name.trim(),
      date: holidayForm.date,
      holiday_type: holidayForm.holiday_type,
      description: holidayForm.description?.trim() || '',
      is_active: true,
    };
    if (!payload.name || !payload.date) {
      setError('Holiday name and date are required.');
      return;
    }
    if (holidayForm.id) {
      await runSave(
        () => settingsService.updateHoliday(holidayForm.id, payload),
        'Holiday updated successfully.',
      );
    } else {
      await runSave(() => settingsService.createHoliday(payload), 'Holiday added successfully.');
    }
  };

  const handleCategorySubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      code: categoryForm.code.trim().toUpperCase().replace(/\s+/g, '_'),
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim(),
    };
    if (!payload.code || !payload.name) {
      setError('Category code and name are required.');
      return;
    }
    if (categoryForm.id) {
      await runSave(
        () => settingsService.updatePolicyCategory(categoryForm.id, payload),
        'Policy category updated successfully.',
      );
    } else {
      await runSave(
        () => settingsService.createPolicyCategory(payload),
        'Policy category added successfully.',
      );
    }
  };

  const handleConfirm = async () => {
    if (!confirm || !canManage) return;
    setIsSaving(true);
    try {
      if (confirm.kind === 'department') {
        await settingsService.setDepartmentActive(confirm.id, confirm.activate);
      } else if (confirm.kind === 'designation') {
        await settingsService.setDesignationActive(confirm.id, confirm.activate);
      } else if (confirm.kind === 'leave-type') {
        await settingsService.setLeaveTypeActive(confirm.id, confirm.activate);
      } else if (confirm.kind === 'policy-category') {
        await settingsService.setPolicyCategoryActive(confirm.id, confirm.activate);
      } else if (confirm.kind === 'holiday') {
        await settingsService.deactivateHoliday(confirm.id);
      }
      setToast({
        message:
          confirm.kind === 'holiday'
            ? 'Holiday deactivated successfully.'
            : confirm.activate
              ? 'Activated successfully.'
              : 'Deactivated successfully.',
        type: 'success',
      });
      setConfirm(null);
      await loadData();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Action failed.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentSection = SECTION_ITEMS.find((item) => item.id === activeSection)!;

  if (isLoading) {
    return (
      <div className="payroll-page hr-settings-page">
        <section className="payroll-card">
          <p className="muted payroll-loading">Loading HR settings...</p>
        </section>
      </div>
    );
  }

  if (error && departments.length === 0 && leaveTypes.length === 0 && categories.length === 0) {
    return (
      <div className="payroll-page hr-settings-page">
        <section className="payroll-card">
          <div className="payroll-header">
            <div className="payroll-header__text">
              <h2 className="payroll-title">HR Settings</h2>
              <p className="payroll-subtitle">Manage HR master data only.</p>
            </div>
          </div>
          <p className="form-error">{error}</p>
          <Button type="button" onClick={() => void loadData()}>
            Retry
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="payroll-page hr-settings-page">
      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}

      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h2 className="payroll-title">HR Settings</h2>
            <p className="payroll-subtitle">
              Manage departments, designations, leave types, holidays, and policy categories. Payroll,
              roles, billing, and company ownership settings are not available here.
            </p>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="hr-settings-nav">
          {SECTION_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`hr-settings-nav__item${activeSection === item.id ? ' is-active' : ''}`}
              onClick={() => {
                setActiveSection(item.id);
                setSearch('');
                setError(null);
                resetForms();
              }}
            >
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h3 className="payroll-title">{currentSection.title}</h3>
            <p className="payroll-subtitle">{currentSection.description}</p>
          </div>
          {activeSection !== 'document-templates' ? (
            <div className="hr-settings-tools">
              <Input
                id="hr-settings-search"
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${currentSection.title.toLowerCase()}...`}
              />
            </div>
          ) : null}
        </div>

        {activeSection === 'departments' ? (
          <>
            {canManage ? (
              <form className="payroll-form hr-settings-form" onSubmit={handleDepartmentSubmit}>
                <div className="form-grid">
                  <Input
                    id="dept_name"
                    label="Department name"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    required
                  />
                  <Input
                    id="dept_description"
                    label="Description"
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
                <div className="payroll-form-actions">
                  <Button type="submit" disabled={isSaving}>
                    {deptForm.id ? 'Update Department' : 'Add Department'}
                  </Button>
                  {deptForm.id ? (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {filteredDepartments.length === 0 ? (
              <TableEmpty message="No departments found. Add your first department to get started." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    {canManage ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.description || '—'}</td>
                      <td>
                        <StatusBadge active={item.is_active} />
                      </td>
                      {canManage ? (
                        <td>
                          <div className="payroll-row-actions">
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setDeptForm({
                                  id: item.id,
                                  name: item.name,
                                  description: item.description || '',
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setConfirm({
                                  kind: 'department',
                                  id: item.id,
                                  name: item.name,
                                  activate: !item.is_active,
                                })
                              }
                            >
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : null}

        {activeSection === 'designations' ? (
          <>
            {canManage ? (
              <form className="payroll-form hr-settings-form" onSubmit={handleDesignationSubmit}>
                <div className="form-grid">
                  <Input
                    id="desig_name"
                    label="Designation name"
                    value={desigForm.name}
                    onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
                    required
                  />
                  <Select
                    id="desig_department"
                    label="Department (optional)"
                    value={String(desigForm.department)}
                    onChange={(e) => setDesigForm({ ...desigForm, department: e.target.value })}
                  >
                    <option value="">No department link</option>
                    {activeDepartments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    id="desig_description"
                    label="Description"
                    value={desigForm.description}
                    onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })}
                  />
                </div>
                <div className="payroll-form-actions">
                  <Button type="submit" disabled={isSaving}>
                    {desigForm.id ? 'Update Designation' : 'Add Designation'}
                  </Button>
                  {desigForm.id ? (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {filteredDesignations.length === 0 ? (
              <TableEmpty message="No designations found. Add a designation to get started." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Status</th>
                    {canManage ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredDesignations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.department_name || '—'}</td>
                      <td>
                        <StatusBadge active={item.is_active} />
                      </td>
                      {canManage ? (
                        <td>
                          <div className="payroll-row-actions">
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setDesigForm({
                                  id: item.id,
                                  name: item.name,
                                  department: item.department ?? '',
                                  description: item.description || '',
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setConfirm({
                                  kind: 'designation',
                                  id: item.id,
                                  name: item.name,
                                  activate: !item.is_active,
                                })
                              }
                            >
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : null}

        {activeSection === 'leave-types' ? (
          <>
            {canManage ? (
              <form className="payroll-form hr-settings-form" onSubmit={handleLeaveTypeSubmit}>
                <div className="form-grid">
                  <Input
                    id="leave_code"
                    label="Code"
                    value={leaveForm.code}
                    onChange={(e) => setLeaveForm({ ...leaveForm, code: e.target.value })}
                    required
                    disabled={Boolean(leaveForm.id)}
                  />
                  <Input
                    id="leave_name"
                    label="Name"
                    value={leaveForm.name}
                    onChange={(e) => setLeaveForm({ ...leaveForm, name: e.target.value })}
                    required
                  />
                  <Input
                    id="leave_quota"
                    label="Annual quota"
                    type="number"
                    min="0"
                    step="0.5"
                    value={leaveForm.annual_quota}
                    onChange={(e) => setLeaveForm({ ...leaveForm, annual_quota: e.target.value })}
                  />
                  <Select
                    id="leave_paid"
                    label="Paid / Unpaid"
                    value={leaveForm.is_paid ? 'paid' : 'unpaid'}
                    onChange={(e) =>
                      setLeaveForm({ ...leaveForm, is_paid: e.target.value === 'paid' })
                    }
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </Select>
                  <Input
                    id="leave_description"
                    label="Description"
                    value={leaveForm.description}
                    onChange={(e) => setLeaveForm({ ...leaveForm, description: e.target.value })}
                  />
                </div>
                <div className="payroll-form-actions">
                  <Button type="submit" disabled={isSaving}>
                    {leaveForm.id ? 'Update Leave Type' : 'Add Leave Type'}
                  </Button>
                  {leaveForm.id ? (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {filteredLeaveTypes.length === 0 ? (
              <TableEmpty message="No leave types found." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Quota</th>
                    <th>Paid</th>
                    <th>Status</th>
                    {canManage ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaveTypes.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{item.annual_quota}</td>
                      <td>{item.is_paid ? 'Paid' : 'Unpaid'}</td>
                      <td>
                        <StatusBadge active={item.is_active} />
                      </td>
                      {canManage ? (
                        <td>
                          <div className="payroll-row-actions">
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setLeaveForm({
                                  id: item.id,
                                  code: item.code,
                                  name: item.name,
                                  annual_quota: item.annual_quota,
                                  is_paid: item.is_paid,
                                  description: item.description || '',
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setConfirm({
                                  kind: 'leave-type',
                                  id: item.id,
                                  name: item.name,
                                  activate: !item.is_active,
                                })
                              }
                            >
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : null}

        {activeSection === 'holidays' ? (
          <>
            {canManage ? (
              <form className="payroll-form hr-settings-form" onSubmit={handleHolidaySubmit}>
                <div className="form-grid">
                  <Input
                    id="holiday_name"
                    label="Holiday name"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    required
                  />
                  <Input
                    id="holiday_date"
                    label="Date"
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    required
                  />
                  <Select
                    id="holiday_type"
                    label="Type"
                    value={holidayForm.holiday_type}
                    onChange={(e) =>
                      setHolidayForm({
                        ...holidayForm,
                        holiday_type: e.target.value as HolidayType,
                      })
                    }
                  >
                    {HOLIDAY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Textarea
                    id="holiday_description"
                    label="Description"
                    value={holidayForm.description || ''}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="payroll-form-actions">
                  <Button type="submit" disabled={isSaving}>
                    {holidayForm.id ? 'Update Holiday' : 'Add Holiday'}
                  </Button>
                  {holidayForm.id ? (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {filteredHolidays.length === 0 ? (
              <TableEmpty message="No holidays found." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Status</th>
                    {canManage ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredHolidays.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.date}</td>
                      <td>{formatHolidayType(item.holiday_type)}</td>
                      <td>{item.description || '—'}</td>
                      <td>
                        <StatusBadge active={item.is_active} />
                      </td>
                      {canManage ? (
                        <td>
                          <div className="payroll-row-actions">
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setHolidayForm({
                                  id: item.id,
                                  name: item.name,
                                  date: item.date,
                                  holiday_type: item.holiday_type,
                                  description: item.description || '',
                                })
                              }
                            >
                              Edit
                            </button>
                            {item.is_active ? (
                              <button
                                type="button"
                                className="payroll-action"
                                onClick={() =>
                                  setConfirm({
                                    kind: 'holiday',
                                    id: item.id,
                                    name: item.name,
                                  })
                                }
                              >
                                Deactivate
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : null}

        {activeSection === 'policy-categories' ? (
          <>
            {canManage ? (
              <form className="payroll-form hr-settings-form" onSubmit={handleCategorySubmit}>
                <div className="form-grid">
                  <Input
                    id="category_code"
                    label="Code"
                    value={categoryForm.code}
                    onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                    required
                    disabled={Boolean(categoryForm.id)}
                  />
                  <Input
                    id="category_name"
                    label="Name"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                  />
                  <Input
                    id="category_description"
                    label="Description"
                    value={categoryForm.description}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="payroll-form-actions">
                  <Button type="submit" disabled={isSaving}>
                    {categoryForm.id ? 'Update Category' : 'Add Category'}
                  </Button>
                  {categoryForm.id ? (
                    <Button type="button" variant="secondary" onClick={resetForms}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            {filteredCategories.length === 0 ? (
              <TableEmpty message="No policy categories found." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    {canManage ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{item.description || '—'}</td>
                      <td>
                        <StatusBadge active={item.is_active} />
                      </td>
                      {canManage ? (
                        <td>
                          <div className="payroll-row-actions">
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setCategoryForm({
                                  id: item.id,
                                  code: item.code,
                                  name: item.name,
                                  description: item.description || '',
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="payroll-action"
                              onClick={() =>
                                setConfirm({
                                  kind: 'policy-category',
                                  id: item.id,
                                  name: item.name,
                                  activate: !item.is_active,
                                })
                              }
                            >
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        ) : null}

        {activeSection === 'document-templates' ? (
          <div className="hr-settings-coming-soon">
            <p className="muted">
              Document template management will be available here once template APIs are ready.
              Offer letter content is currently managed from the Offer Letters module.
            </p>
            <div className="hr-settings-template-grid">
              {DOCUMENT_TEMPLATES.map((item) => (
                <article key={item.name} className="hr-settings-template-card">
                  <h4>{item.name}</h4>
                  <Badge variant={item.status.startsWith('Coming') ? 'warning' : 'info'}>
                    {item.status}
                  </Badge>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(confirm)}
        title={
          confirm?.kind === 'holiday'
            ? 'Deactivate holiday'
            : confirm?.activate
              ? 'Activate item'
              : 'Deactivate item'
        }
        onClose={() => {
          if (!isSaving) setConfirm(null);
        }}
        footer={
          <div className="payroll-form-actions">
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleConfirm()}>
              Confirm
            </Button>
          </div>
        }
      >
        <p>
          {confirm?.kind === 'holiday'
            ? `Deactivate holiday "${confirm.name}"? It will no longer appear in active holiday lists.`
            : confirm
              ? `${confirm.activate ? 'Activate' : 'Deactivate'} "${confirm.name}"?`
              : null}
        </p>
      </Modal>
    </div>
  );
}
