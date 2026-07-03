import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

import { HolidayList2026 } from '../../components/settings/HolidayList2026';
import { Button, FormSection, Input, Select } from '../../components/ui';
import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  SlidersIcon,
} from '../../components/policies/policyIcons';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { settingsService } from '../../services/settingsService';
import type { CompanyHoliday, CompanySettings } from '../../types';
import { MONTH_OPTIONS, WEEKDAY_OPTIONS } from '../../types/settings';

const HOLIDAY_YEAR = 2026;

export function CompanySettingsPage() {
  const { can } = useAuth();
  const canManageSettings = can('can_manage_company_settings');
  const canManageHolidays = can('can_manage_holidays');

  const [settingsForm, setSettingsForm] = useState<CompanySettings | null>(null);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [companySettings, holidayList] = await Promise.all([
        settingsService.getCompanySettings(),
        settingsService.listHolidays(HOLIDAY_YEAR),
      ]);
      setSettingsForm(companySettings);
      setHolidays(holidayList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load company settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const toggleWeeklyOff = (day: number) => {
    if (!settingsForm || !canManageSettings) return;
    const current = settingsForm.weekly_off_days ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setSettingsForm({ ...settingsForm, weekly_off_days: next.sort() });
  };

  const handleSaveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!settingsForm || !canManageSettings) return;

    setIsSavingSettings(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await settingsService.updateCompanySettings({
        company_name: settingsForm.company_name,
        office_start_time: settingsForm.office_start_time.slice(0, 5),
        office_end_time: settingsForm.office_end_time.slice(0, 5),
        full_day_minimum_hours: settingsForm.full_day_minimum_hours,
        half_day_minimum_hours: settingsForm.half_day_minimum_hours,
        weekly_off_days: settingsForm.weekly_off_days,
        financial_year_start_month: settingsForm.financial_year_start_month,
        leave_joining_cutoff_day: settingsForm.leave_joining_cutoff_day,
      });
      setSettingsForm(updated);
      setSuccess('Company settings saved successfully.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save company settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoading) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="muted">Loading company settings...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="payroll-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h2 className="payroll-title">Company Settings</h2>
            <p className="payroll-subtitle">
              {canManageSettings
                ? 'Configure company profile, attendance rules, leave accrual, and holidays.'
                : 'View company configuration. Contact a super admin to change these settings.'}
            </p>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        {settingsForm ? (
          <form className="payroll-form" onSubmit={handleSaveSettings}>
            <FormSection title="General" icon={<BuildingIcon />} description="Core company profile and office hours.">
              <div className="form-grid">
                <Input
                  id="company_name"
                  label="Company Name"
                  value={settingsForm.company_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                  disabled={!canManageSettings}
                  required
                />
                <TimeField
                  id="office_start_time"
                  label="Office Start Time"
                  value={settingsForm.office_start_time.slice(0, 5)}
                  onChange={(e) => setSettingsForm({ ...settingsForm, office_start_time: e.target.value })}
                  disabled={!canManageSettings}
                  required
                />
                <TimeField
                  id="office_end_time"
                  label="Office End Time"
                  value={settingsForm.office_end_time.slice(0, 5)}
                  onChange={(e) => setSettingsForm({ ...settingsForm, office_end_time: e.target.value })}
                  disabled={!canManageSettings}
                  required
                />
              </div>
            </FormSection>

            <FormSection
              title="Attendance Rules"
              icon={<SlidersIcon />}
              description="Used for present / half-day / absent calculation."
            >
              <div className="form-grid">
                <Input
                  id="full_day_minimum_hours"
                  label="Full Day Minimum Hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={settingsForm.full_day_minimum_hours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, full_day_minimum_hours: e.target.value })}
                  disabled={!canManageSettings}
                  required
                />
                <Input
                  id="half_day_minimum_hours"
                  label="Half Day Minimum Hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={settingsForm.half_day_minimum_hours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, half_day_minimum_hours: e.target.value })}
                  disabled={!canManageSettings}
                  required
                />
              </div>
            </FormSection>

            <FormSection
              title="Leave & Calendar"
              icon={<CalendarIcon />}
              description="Weekly offs and leave accrual configuration."
            >
              <div className="form-grid">
                <Select
                  id="financial_year_start_month"
                  label="Financial Year Start Month"
                  value={String(settingsForm.financial_year_start_month)}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, financial_year_start_month: Number(e.target.value) })
                  }
                  disabled={!canManageSettings}
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </Select>
                <Input
                  id="leave_joining_cutoff_day"
                  label="Leave Joining Cutoff Day"
                  type="number"
                  min="1"
                  max="31"
                  value={settingsForm.leave_joining_cutoff_day}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, leave_joining_cutoff_day: Number(e.target.value) })
                  }
                  disabled={!canManageSettings}
                  hint="Join on or before this day earns leave for that month."
                  required
                />
              </div>

              <div className="settings-weekly">
                <span className="ui-label">Weekly Off Days</span>
                <div className="settings-day-chips">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const selected = settingsForm.weekly_off_days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        className={`settings-day-chip${selected ? ' settings-day-chip--active' : ''}`}
                        onClick={() => toggleWeeklyOff(day.value)}
                        disabled={!canManageSettings}
                        aria-pressed={selected}
                      >
                        {selected ? <CheckIcon /> : null}
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </FormSection>

            {canManageSettings ? (
              <div className="payroll-form-actions">
                <Button type="submit" disabled={isSavingSettings}>
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            ) : null}
          </form>
        ) : null}
      </section>

      <section className="payroll-card">
        <HolidayList2026
          holidays={holidays}
          canManage={canManageHolidays}
          onUpdated={loadData}
          onError={setError}
          onSuccess={setSuccess}
        />
      </section>
    </div>
  );
}

function TimeField({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="ui-field">
      <label htmlFor={id} className="ui-label">
        {label}
        {required ? <span className="ui-required">*</span> : null}
      </label>
      <div className="settings-time">
        <span className="settings-time__icon" aria-hidden>
          <ClockIcon />
        </span>
        <input
          id={id}
          className="ui-input settings-time__input"
          type="time"
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
        />
      </div>
    </div>
  );
}
