import type { ReactNode } from 'react';

interface OverviewSegment {
  label: string;
  value: number;
  color: string;
}

interface AdminDashboardOverviewProps {
  hasRecords: boolean;
}

const ATTENDANCE_PREVIEW: OverviewSegment[] = [
  { label: 'Present', value: 68, color: '#4b2d84' },
  { label: 'Absent', value: 12, color: '#e57373' },
  { label: 'Late', value: 8, color: '#e0a845' },
  { label: 'On Leave', value: 12, color: '#28b8d8' },
];

const LEAVE_PREVIEW: OverviewSegment[] = [
  { label: 'Pending', value: 35, color: '#d97706' },
  { label: 'Approved', value: 50, color: '#0f766e' },
  { label: 'Rejected', value: 15, color: '#e57373' },
];

const LEAVE_TOTAL_REQUESTS = 20;
const ATTENDANCE_CENTER = ATTENDANCE_PREVIEW[0];

function ChartEmptyState({ icon }: { icon: ReactNode }) {
  return (
    <div className="dashboard-overview-empty">
      <div className="dashboard-overview-empty__icon">{icon}</div>
      <p className="dashboard-overview-empty__title">No data available yet</p>
      <p className="dashboard-overview-empty__text">Data will appear once records are available</p>
    </div>
  );
}

function AttendanceEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function LeaveEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function OverviewCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="dashboard-overview-card">
      <header className="dashboard-overview-card__header">
        <h3 className="dashboard-overview-card__title">{title}</h3>
        <p className="dashboard-overview-card__subtitle">{subtitle}</p>
      </header>
      {children}
    </article>
  );
}

function DonutChart({ segments }: { segments: OverviewSegment[] }) {
  let cumulative = 0;

  return (
    <div className="dashboard-donut" role="img" aria-label="Attendance breakdown chart">
      <svg className="dashboard-donut__svg" viewBox="0 0 42 42" aria-hidden>
        <circle className="dashboard-donut__track" cx="21" cy="21" r="15.915" />
        {segments.map((segment) => {
          const dashArray = `${segment.value} ${100 - segment.value}`;
          const dashOffset = 25 - cumulative;
          cumulative += segment.value;

          return (
            <circle
              key={segment.label}
              className="dashboard-donut__segment"
              cx="21"
              cy="21"
              r="15.915"
              stroke={segment.color}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="dashboard-donut__center">
        <strong className="dashboard-donut__value">{ATTENDANCE_CENTER.value}%</strong>
        <span className="dashboard-donut__label">{ATTENDANCE_CENTER.label}</span>
      </div>
    </div>
  );
}

function AttendanceOverview({ segments }: { segments: OverviewSegment[] }) {
  return (
    <div className="dashboard-attendance-modern">
      <DonutChart segments={segments} />
      <ul className="dashboard-attendance-stats">
        {segments.map((segment) => (
          <li key={segment.label} className="dashboard-attendance-stats__item">
            <span className="dashboard-attendance-stats__dot" style={{ backgroundColor: segment.color }} />
            <span className="dashboard-attendance-stats__label">{segment.label}</span>
            <span className="dashboard-attendance-stats__value">{segment.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ApprovedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function RejectedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

const LEAVE_ICONS: Record<string, ReactNode> = {
  Pending: <PendingIcon />,
  Approved: <ApprovedIcon />,
  Rejected: <RejectedIcon />,
};

function LeaveMiniCards({ segments }: { segments: OverviewSegment[] }) {
  return (
    <div className="dashboard-leave-minis">
      {segments.map((segment) => (
        <div
          key={segment.label}
          className={`dashboard-leave-mini dashboard-leave-mini--${segment.label.toLowerCase()}`}
        >
          <div className="dashboard-leave-mini__icon" style={{ color: segment.color }}>
            {LEAVE_ICONS[segment.label]}
          </div>
          <div className="dashboard-leave-mini__content">
            <span className="dashboard-leave-mini__label">{segment.label}</span>
            <strong className="dashboard-leave-mini__value">{segment.value}%</strong>
            <div className="dashboard-leave-mini__track">
              <span
                className="dashboard-leave-mini__fill"
                style={{ width: `${segment.value}%`, backgroundColor: segment.color }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaveTotalRing({ total }: { total: number }) {
  const approvedPercent = LEAVE_PREVIEW.find((item) => item.label === 'Approved')?.value ?? 50;

  return (
    <div className="dashboard-leave-ring" role="img" aria-label={`${total} total leave requests`}>
      <svg className="dashboard-leave-ring__svg" viewBox="0 0 42 42" aria-hidden>
        <circle className="dashboard-leave-ring__track" cx="21" cy="21" r="15.915" />
        <circle
          className="dashboard-leave-ring__segment"
          cx="21"
          cy="21"
          r="15.915"
          strokeDasharray={`${approvedPercent} ${100 - approvedPercent}`}
          strokeDashoffset="25"
        />
      </svg>
      <div className="dashboard-leave-ring__center">
        <strong className="dashboard-leave-ring__value">{total}</strong>
        <span className="dashboard-leave-ring__label">Total Requests</span>
      </div>
    </div>
  );
}

function LeaveOverview({ segments }: { segments: OverviewSegment[] }) {
  return (
    <div className="dashboard-leave-modern">
      <LeaveMiniCards segments={segments} />
      <LeaveTotalRing total={LEAVE_TOTAL_REQUESTS} />
    </div>
  );
}

export function AdminDashboardOverview({ hasRecords }: AdminDashboardOverviewProps) {
  return (
    <section className="dashboard-section dashboard-section--overview dashboard-overview-grid" aria-label="Workforce overview">
      <OverviewCard title="Attendance Overview" subtitle="Today's workforce status">
        {hasRecords ? (
          <AttendanceOverview segments={ATTENDANCE_PREVIEW} />
        ) : (
          <ChartEmptyState icon={<AttendanceEmptyIcon />} />
        )}
      </OverviewCard>

      <OverviewCard title="Leave Overview" subtitle="Request status summary">
        {hasRecords ? (
          <LeaveOverview segments={LEAVE_PREVIEW} />
        ) : (
          <ChartEmptyState icon={<LeaveEmptyIcon />} />
        )}
      </OverviewCard>
    </section>
  );
}
