import type { LeadActivity } from '../../types/lead';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ActivityTimelineProps {
  activities: LeadActivity[];
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return <p className="muted">No activities logged yet.</p>;
  }

  return (
    <div className="lead-timeline">
      {activities.map((activity) => (
        <article key={activity.id} className="lead-timeline__item">
          <div className="lead-timeline__marker" aria-hidden />
          <div className="lead-timeline__content">
            <div className="lead-timeline__top">
              <h4>{activity.activity_type_display}</h4>
              {!activity.is_countable_for_kpi ? (
                <span className="lead-timeline__badge">Not counted for KPI</span>
              ) : null}
            </div>
            <p className="lead-timeline__meta">
              {activity.created_by_name} · {formatDateTime(activity.created_at)}
            </p>
            {activity.notes ? <p className="lead-timeline__notes">{activity.notes}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
