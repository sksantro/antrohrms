import { useEffect, useMemo, useRef, useState } from 'react';

interface DatePickerProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  className?: string;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MIN_YEAR = 1900;
const MAX_YEAR_OFFSET = 20;

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarDays(viewDate: Date): Array<{ date: Date; iso: string; outsideMonth: boolean }> {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return {
      date,
      iso: formatIsoDate(date),
      outsideMonth: date.getMonth() !== viewDate.getMonth(),
    };
  });
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {direction === 'left' ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Select date',
  error,
  hint,
  className,
}: DatePickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? new Date());

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedDate]);

  const calendarDays = useMemo(() => getCalendarDays(viewDate), [viewDate]);
  const todayIso = formatIsoDate(new Date());
  const maxYear = new Date().getFullYear() + MAX_YEAR_OFFSET;
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let year = maxYear; year >= MIN_YEAR; year -= 1) {
      years.push(year);
    }
    return years;
  }, [maxYear]);

  const toggleOpen = () => {
    if (disabled) return;
    setViewDate(new Date((selectedDate ?? new Date()).getFullYear(), (selectedDate ?? new Date()).getMonth(), 1));
    setIsOpen((open) => !open);
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')} ref={wrapperRef}>
      {label ? (
        <label htmlFor={id} className="ui-label">
          {label}
          {required ? <span className="ui-required">*</span> : null}
        </label>
      ) : null}

      <div className={`ui-date-picker${isOpen ? ' ui-date-picker--open' : ''}${disabled ? ' ui-date-picker--disabled' : ''}`}>
        <input
          className="ui-date-input-proxy"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          onChange={() => {}}
          required={required}
          disabled={disabled}
        />
        <button
          id={id}
          type="button"
          className={`ui-date-trigger${error ? ' ui-date-trigger--error' : ''}`}
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          disabled={disabled}
        >
          <span className="ui-date-trigger__icon">
            <CalendarIcon />
          </span>
          <span className={`ui-date-trigger__value${value ? '' : ' ui-date-trigger__value--placeholder'}`}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </button>

        {isOpen ? (
          <div className="ui-date-popover" role="dialog" aria-label={`${label ?? 'Date'} calendar`}>
            <div className="ui-date-popover__header">
              <button
                type="button"
                className="ui-date-popover__nav"
                onClick={() => setViewDate((current) => shiftMonth(current, -1))}
                aria-label="Previous month"
              >
                <ChevronIcon direction="left" />
              </button>
              <div className="ui-date-popover__controls">
                <label className="ui-date-popover__select-wrap">
                  <span className="ui-date-popover__select-label">Month</span>
                  <select
                    className="ui-date-popover__select"
                    value={viewDate.getMonth()}
                    onChange={(event) =>
                      setViewDate(
                        new Date(viewDate.getFullYear(), Number(event.target.value), 1),
                      )
                    }
                  >
                    {MONTH_OPTIONS.map((month, index) => (
                      <option key={month} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ui-date-popover__select-wrap">
                  <span className="ui-date-popover__select-label">Year</span>
                  <select
                    className="ui-date-popover__select ui-date-popover__select--year"
                    value={viewDate.getFullYear()}
                    onChange={(event) =>
                      setViewDate(
                        new Date(Number(event.target.value), viewDate.getMonth(), 1),
                      )
                    }
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="ui-date-popover__nav"
                onClick={() => setViewDate((current) => shiftMonth(current, 1))}
                aria-label="Next month"
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <div className="ui-date-weekdays" aria-hidden>
              {WEEKDAY_LABELS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="ui-date-grid">
              {calendarDays.map((day) => {
                const isSelected = day.iso === value;
                const isToday = day.iso === todayIso;

                return (
                  <button
                    key={day.iso}
                    type="button"
                    className={[
                      'ui-date-cell',
                      day.outsideMonth ? 'ui-date-cell--outside' : '',
                      isToday ? 'ui-date-cell--today' : '',
                      isSelected ? 'ui-date-cell--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleSelect(day.iso)}
                  >
                    {day.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="ui-field-error">{error}</p> : null}
      {!error && hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}
