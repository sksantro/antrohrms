import type { ReactNode } from 'react';

import { Badge } from '../../components/ui';

type BadgeVariant = 'success' | 'neutral' | 'warning' | 'danger' | 'accent' | 'info';

interface ActionListItem {
  icon: ReactNode;
  title: string;
  subtext: string;
  badge?: { label: string; variant: BadgeVariant };
  timestamp?: string;
}

interface ActionCardConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: ActionListItem[];
}

function CardHeaderIcon({ children }: { children: ReactNode }) {
  return <span className="dashboard-action-card__header-icon">{children}</span>;
}

function PendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function UpcomingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function LeaveItemIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function RegularizationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PolicyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function PayrollIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function EmployeeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AttendanceItemIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

function HolidayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function BirthdayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 12v8H4v-8" />
      <path d="M22 12H2" />
      <path d="M12 4v8M8 8h8" />
    </svg>
  );
}

function JoiningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

const ACTION_CARDS: ActionCardConfig[] = [
  {
    id: 'pending',
    title: 'Pending Actions',
    subtitle: 'Tasks needing your attention',
    icon: <PendingIcon />,
    items: [
      {
        icon: <LeaveItemIcon />,
        title: 'Leave approvals pending',
        subtext: '3 requests awaiting review',
        badge: { label: '3 pending', variant: 'warning' },
      },
      {
        icon: <RegularizationIcon />,
        title: 'Attendance regularization pending',
        subtext: '2 corrections need approval',
        badge: { label: '2 pending', variant: 'warning' },
      },
      {
        icon: <PolicyIcon />,
        title: 'Policy acknowledgements pending',
        subtext: '5 employees yet to acknowledge',
        badge: { label: '5 open', variant: 'accent' },
      },
      {
        icon: <PayrollIcon />,
        title: 'Payroll review pending',
        subtext: 'Draft run ready for review',
        badge: { label: 'Review', variant: 'info' },
      },
    ],
  },
  {
    id: 'activity',
    title: 'Recent Activity',
    subtitle: 'Latest updates across HRMS',
    icon: <ActivityIcon />,
    items: [
      {
        icon: <EmployeeIcon />,
        title: 'New employee added',
        subtext: 'Priya Sharma joined Engineering',
        timestamp: '2h ago',
      },
      {
        icon: <LeaveItemIcon />,
        title: 'Leave request submitted',
        subtext: 'Rahul Verma applied for casual leave',
        timestamp: '4h ago',
      },
      {
        icon: <AttendanceItemIcon />,
        title: 'Attendance updated',
        subtext: 'Daily attendance sync completed',
        timestamp: '6h ago',
      },
      {
        icon: <PolicyIcon />,
        title: 'Policy assigned',
        subtext: 'IT Security Policy sent to all staff',
        timestamp: 'Yesterday',
      },
    ],
  },
  {
    id: 'upcoming',
    title: 'Upcoming',
    subtitle: 'HR events on the horizon',
    icon: <UpcomingIcon />,
    items: [
      {
        icon: <HolidayIcon />,
        title: 'Upcoming holidays',
        subtext: 'Independence Day — 15 Aug',
        badge: { label: 'Holiday', variant: 'success' },
      },
      {
        icon: <BirthdayIcon />,
        title: 'Employee birthdays',
        subtext: 'Anita Rao — 12 Jul',
        timestamp: 'In 3 days',
      },
      {
        icon: <JoiningIcon />,
        title: 'Joining dates',
        subtext: '2 new joiners next week',
        badge: { label: '2 upcoming', variant: 'info' },
      },
      {
        icon: <ReviewIcon />,
        title: 'Probation reviews',
        subtext: '4 reviews due this month',
        badge: { label: '4 due', variant: 'neutral' },
      },
    ],
  },
];

function ActionListItemRow({ item }: { item: ActionListItem }) {
  return (
    <li className="dashboard-action-item">
      <span className="dashboard-action-item__icon">{item.icon}</span>
      <div className="dashboard-action-item__content">
        <span className="dashboard-action-item__title">{item.title}</span>
        <span className="dashboard-action-item__subtext">{item.subtext}</span>
      </div>
      {item.badge ? (
        <Badge variant={item.badge.variant} className="dashboard-action-item__badge">
          {item.badge.label}
        </Badge>
      ) : null}
      {item.timestamp ? <span className="dashboard-action-item__time">{item.timestamp}</span> : null}
    </li>
  );
}

function ActionCard({ card }: { card: ActionCardConfig }) {
  return (
    <article
      className="dashboard-action-card"
      aria-label={card.title}
    >
      <div className="dashboard-action-card__glow" aria-hidden />
      <header className="dashboard-action-card__header">
        <div className="dashboard-action-card__heading">
          <CardHeaderIcon>{card.icon}</CardHeaderIcon>
          <div>
            <h3 className="dashboard-action-card__title">{card.title}</h3>
            <p className="dashboard-action-card__subtitle">{card.subtitle}</p>
          </div>
        </div>
        <button type="button" className="dashboard-action-card__view-all">
          View all
        </button>
      </header>
      <ul className="dashboard-action-card__list">
        {card.items.map((item) => (
          <ActionListItemRow key={`${card.id}-${item.title}`} item={item} />
        ))}
      </ul>
    </article>
  );
}

export function AdminDashboardActionCenter() {
  return (
    <section className="dashboard-section dashboard-section--actions dashboard-action-center" aria-label="Action Center">
      <div className="dashboard-action-center__intro">
        <h2 className="dashboard-action-center__title">Action Center</h2>
        <p className="dashboard-action-center__subtitle">Stay on top of tasks, activity, and upcoming HR events</p>
      </div>
      <div className="dashboard-action-center__grid">
        {ACTION_CARDS.map((card) => (
          <ActionCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
