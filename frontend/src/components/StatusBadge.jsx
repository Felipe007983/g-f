import { daysLateLabel, statusLabel } from '../api';

/** Badge de status com dias em atraso, quando houver. */
export default function StatusBadge({ status, daysLate = 0 }) {
  const late = status === 'overdue' ? daysLateLabel(daysLate) : '';

  return (
    <span className="status-with-days">
      <span className={`badge badge-${status}`}>{statusLabel(status)}</span>
      {late ? <span className="days-late">{late} em atraso</span> : null}
    </span>
  );
}
