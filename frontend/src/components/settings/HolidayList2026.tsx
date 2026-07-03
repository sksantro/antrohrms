import { useMemo, useState } from 'react';

import { ApiError } from '../../services/api';
import { settingsService } from '../../services/settingsService';
import type { CompanyHoliday } from '../../types';
import { formatHolidayType } from '../../types/settings';

const HOLIDAY_YEAR = 2026;

interface ParsedHoliday {
  holiday: CompanyHoliday;
  day: string;
  monthShort: string;
  monthLong: string;
  weekday: string;
  fullLabel: string;
}

function parseHolidayDate(dateText: string): Omit<ParsedHoliday, 'holiday'> {
  const date = new Date(`${dateText}T00:00:00`);
  return {
    day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
    monthShort: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    monthLong: date.toLocaleDateString('en-IN', { month: 'long' }),
    weekday: date.toLocaleDateString('en-IN', { weekday: 'long' }),
    fullLabel: date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

function getTypeClass(holiday: CompanyHoliday): string {
  if (holiday.is_optional) return 'holiday-type--optional';
  if (holiday.holiday_type === 'NATIONAL_HOLIDAY') return 'holiday-type--national';
  if (holiday.holiday_type === 'FESTIVAL') return 'holiday-type--festival';
  return 'holiday-type--company';
}

interface HolidayList2026Props {
  holidays: CompanyHoliday[];
  canManage: boolean;
  onUpdated: () => Promise<void>;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}

export function HolidayList2026({
  holidays,
  canManage,
  onUpdated,
  onError,
  onSuccess,
}: HolidayList2026Props) {
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const yearHolidays = useMemo(
    () =>
      holidays
        .filter((holiday) => holiday.date.startsWith(String(HOLIDAY_YEAR)) && holiday.is_active)
        .map((holiday) => ({ ...parseHolidayDate(holiday.date), holiday }))
        .sort((a, b) => a.holiday.date.localeCompare(b.holiday.date)),
    [holidays],
  );

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, ParsedHoliday[]>();
    for (const item of yearHolidays) {
      const key = item.monthLong;
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }
    return groups;
  }, [yearHolidays]);

  const optionalCount = yearHolidays.filter((item) => item.holiday.is_optional).length;

  const handleToggleOptional = async (holiday: CompanyHoliday) => {
    if (!canManage) return;
    setTogglingId(holiday.id);
    onError(null);
    onSuccess(null);
    try {
      await settingsService.toggleHolidayOptional(holiday.id);
      onSuccess(
        holiday.is_optional
          ? `${holiday.name} marked as regular holiday.`
          : `${holiday.name} marked as optional holiday.`,
      );
      await onUpdated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Unable to update holiday.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section className="holiday-list-2026">
      <header className="holiday-hero">
        <div className="holiday-hero-content">
          <div className="holiday-hero-text">
            <span className="holiday-year-badge">{HOLIDAY_YEAR}</span>
            <h3>2026 Holiday List</h3>
            <p>
              Official company holidays for {HOLIDAY_YEAR}.
              {canManage
                ? ' Toggle optional holidays for employees who may choose whether to take them.'
                : ' Optional holidays are marked separately below.'}
            </p>
          </div>
          <div className="holiday-hero-stats">
            <div className="holiday-stat-card">
              <span className="holiday-stat-value">{yearHolidays.length}</span>
              <span className="holiday-stat-label">Total holidays</span>
            </div>
            <div className="holiday-stat-card holiday-stat-card--accent">
              <span className="holiday-stat-value">{optionalCount}</span>
              <span className="holiday-stat-label">Optional</span>
            </div>
          </div>
        </div>
      </header>

      {yearHolidays.length ? (
        <div className="holiday-timeline">
          {Array.from(groupedByMonth.entries()).map(([month, items]) => (
            <div key={month} className="holiday-month-group">
              <div className="holiday-month-heading">
                <span className="holiday-month-name">{month}</span>
                <span className="holiday-month-count">
                  {items.length} {items.length === 1 ? 'holiday' : 'holidays'}
                </span>
              </div>

              <ul className="holiday-rows">
                {items.map((item) => {
                  const { holiday } = item;
                  const typeClass = getTypeClass(holiday);
                  const typeLabel = holiday.is_optional
                    ? 'Optional Holiday'
                    : formatHolidayType(holiday.holiday_type);

                  return (
                    <li
                      key={holiday.id}
                      className={`holiday-row${holiday.is_optional ? ' holiday-row--optional' : ''}`}
                    >
                      <div className={`holiday-row-date ${typeClass}`}>
                        <span className="holiday-row-day">{item.day}</span>
                        <span className="holiday-row-month">{item.monthShort}</span>
                      </div>

                      <div className="holiday-row-main">
                        <div className="holiday-row-top">
                          <h4>{holiday.name}</h4>
                          <span className={`holiday-type-tag ${typeClass}`}>{typeLabel}</span>
                        </div>
                        <p className="holiday-row-meta">
                          {item.weekday}
                          <span className="holiday-row-dot" aria-hidden="true">
                            ·
                          </span>
                          {item.fullLabel}
                        </p>
                      </div>

                      {canManage ? (
                        <div className="holiday-row-action">
                          <button
                            type="button"
                            className={`holiday-switch${holiday.is_optional ? ' holiday-switch--on' : ''}`}
                            role="switch"
                            aria-checked={holiday.is_optional}
                            aria-label={`Mark ${holiday.name} as optional`}
                            disabled={togglingId === holiday.id}
                            onClick={() => void handleToggleOptional(holiday)}
                          >
                            <span className="holiday-switch-track">
                              <span className="holiday-switch-thumb" />
                            </span>
                            <span className="holiday-switch-label">Optional</span>
                          </button>
                        </div>
                      ) : holiday.is_optional ? (
                        <span className="holiday-optional-badge">Optional</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="holiday-empty-state">
          <p>No holidays found for {HOLIDAY_YEAR}.</p>
          <p className="muted">Ask your administrator to load the 2026 holiday list.</p>
        </div>
      )}
    </section>
  );
}
