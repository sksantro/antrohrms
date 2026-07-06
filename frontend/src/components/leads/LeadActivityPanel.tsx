import { useMemo, useState } from 'react';

import { Button } from '../ui';
import type { LeadActivity, LeadActivityStatus } from '../../types/lead';
import { CloseActivityModal } from './CloseActivityModal';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(status: LeadActivityStatus): string {
  if (status === 'OPEN') return 'is-open';
  if (status === 'IN_PROGRESS') return 'is-progress';
  if (status === 'DONE') return 'is-done';
  return 'is-closed';
}

interface LeadActivityPanelProps {
  activities: LeadActivity[];
  isSubmitting?: boolean;
  onUpdateStatus: (activity: LeadActivity, status: LeadActivityStatus, completionNotes?: string) => Promise<void>;
}

function ActivityCard({
  activity,
  isSubmitting,
  onStart,
  onMarkDone,
  onClose,
  showActions,
}: {
  activity: LeadActivity;
  isSubmitting?: boolean;
  onStart: () => void;
  onMarkDone: () => void;
  onClose: () => void;
  showActions: boolean;
}) {
  return (
    <article
      className={[
        'lead-activity-card',
        activity.is_overdue ? 'is-overdue' : '',
        getStatusClass(activity.status),
      ].filter(Boolean).join(' ')}
    >
      <div className="lead-activity-card__top">
        <div>
          <h4>{activity.activity_type_display}</h4>
          <p className="lead-activity-card__meta">
            Assigned to {activity.assigned_to_name} · Due {formatDate(activity.due_date)}
          </p>
        </div>
        <div className="lead-activity-card__badges">
          <span className={['lead-activity-status', getStatusClass(activity.status)].join(' ')}>
            {activity.status_display}
          </span>
          <span className="lead-activity-priority">{activity.priority_display} priority</span>
          {!activity.is_countable_for_kpi ? (
            <span className="lead-timeline__badge">Not counted for KPI</span>
          ) : (
            <span className="lead-activity-counted">Counted for KPI: Yes</span>
          )}
          {!activity.is_countable_for_kpi && activity.not_counted_reason ? (
            <span className="lead-activity-not-counted-reason">{activity.not_counted_reason}</span>
          ) : null}
          {activity.is_deleted ? <span className="lead-timeline__badge">Deleted</span> : null}
          {activity.is_overdue ? <span className="lead-activity-overdue">Overdue</span> : null}
        </div>
      </div>

      {activity.notes ? <p className="lead-activity-card__notes">{activity.notes}</p> : null}

      {showActions ? (
        <div className="lead-activity-card__actions">
          {activity.status === 'OPEN' ? (
            <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onStart}>
              Start
            </Button>
          ) : null}
          <Button type="button" disabled={isSubmitting} onClick={onMarkDone}>
            Mark Done
          </Button>
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Close
          </Button>
        </div>
      ) : null}

      {activity.completion_notes ? (
        <p className="lead-activity-card__completion">
          <strong>Completed:</strong> {activity.completion_notes}
        </p>
      ) : null}
      {activity.completed_at ? (
        <p className="lead-activity-card__completed-at">Closed on {formatDateTime(activity.completed_at)}</p>
      ) : null}
    </article>
  );
}

export function LeadActivityPanel({ activities, isSubmitting, onUpdateStatus }: LeadActivityPanelProps) {
  const [closingActivity, setClosingActivity] = useState<LeadActivity | null>(null);
  const [closeStatus, setCloseStatus] = useState<'DONE' | 'CLOSED'>('DONE');
  const [closeError, setCloseError] = useState<string | null>(null);

  const pendingActivities = useMemo(
    () => activities.filter((activity) => activity.status === 'OPEN' || activity.status === 'IN_PROGRESS'),
    [activities],
  );
  const overdueActivities = useMemo(
    () => pendingActivities.filter((activity) => activity.is_overdue),
    [pendingActivities],
  );
  const completedActivities = useMemo(
    () => activities.filter((activity) => activity.status === 'DONE' || activity.status === 'CLOSED'),
    [activities],
  );

  const openCloseModal = (activity: LeadActivity, status: 'DONE' | 'CLOSED') => {
    setCloseError(null);
    setClosingActivity(activity);
    setCloseStatus(status);
  };

  const handleCloseSubmit = async (completionNotes: string) => {
    if (!closingActivity) return;
    setCloseError(null);
    try {
      await onUpdateStatus(closingActivity, closeStatus, completionNotes);
      setClosingActivity(null);
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : 'Unable to update activity.');
    }
  };

  if (activities.length === 0) {
    return <p className="muted">No activities logged yet.</p>;
  }

  return (
    <div className="lead-activity-panel">
      <section className="lead-activity-section">
        <div className="lead-activity-section__header">
          <h4>Pending Activities</h4>
          <span className="lead-activity-section__count">{pendingActivities.length}</span>
        </div>
        {pendingActivities.length === 0 ? (
          <p className="muted">No open activities. All tasks are completed.</p>
        ) : (
          <div className="lead-activity-list">
            {pendingActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isSubmitting={isSubmitting}
                showActions
                onStart={() => void onUpdateStatus(activity, 'IN_PROGRESS')}
                onMarkDone={() => openCloseModal(activity, 'DONE')}
                onClose={() => openCloseModal(activity, 'CLOSED')}
              />
            ))}
          </div>
        )}
      </section>

      {overdueActivities.length > 0 ? (
        <section className="lead-activity-section lead-activity-section--overdue">
          <div className="lead-activity-section__header">
            <h4>Overdue</h4>
            <span className="lead-activity-section__count is-overdue">{overdueActivities.length}</span>
          </div>
          <p className="muted">These pending activities are past their due date.</p>
        </section>
      ) : null}

      <section className="lead-activity-section">
        <div className="lead-activity-section__header">
          <h4>Completed / Closed</h4>
          <span className="lead-activity-section__count">{completedActivities.length}</span>
        </div>
        {completedActivities.length === 0 ? (
          <p className="muted">Completed activities will appear here once marked done or closed.</p>
        ) : (
          <div className="lead-activity-list">
            {completedActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                showActions={false}
                onStart={() => undefined}
                onMarkDone={() => undefined}
                onClose={() => undefined}
              />
            ))}
          </div>
        )}
      </section>

      <CloseActivityModal
        open={Boolean(closingActivity)}
        activity={closingActivity}
        targetStatus={closeStatus}
        isSubmitting={isSubmitting}
        error={closeError}
        onClose={() => {
          setClosingActivity(null);
          setCloseError(null);
        }}
        onSubmit={handleCloseSubmit}
      />
    </div>
  );
}
