import type { LeadStatusChange } from '../../types/lead';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface StatusChangeHistoryProps {
  changes: LeadStatusChange[];
}

export function StatusChangeHistory({ changes }: StatusChangeHistoryProps) {
  if (changes.length === 0) {
    return <p className="muted">No status changes recorded yet.</p>;
  }

  return (
    <div className="lead-status-history">
      {changes.map((change) => (
        <article key={change.id} className="lead-status-history__item">
          <div className="lead-status-history__top">
            <span className="lead-status-history__transition">
              {change.previous_status_display || '—'} → {change.new_status_display}
            </span>
            {!change.is_countable_for_kpi ? (
              <span className="lead-timeline__badge">Not counted for KPI</span>
            ) : null}
          </div>
          <p className="lead-timeline__meta">
            {change.changed_by_name} · {formatDateTime(change.changed_at)}
          </p>
          {change.remarks ? <p className="lead-timeline__notes">{change.remarks}</p> : null}
        </article>
      ))}
    </div>
  );
}
