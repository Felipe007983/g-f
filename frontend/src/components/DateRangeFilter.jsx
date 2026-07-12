import { useEffect, useMemo, useRef, useState } from 'react';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function toISO(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function sameDay(a, b) {
  return a && b && toISO(a) === toISO(b);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function buildMonthDays(viewDate) {
  const first = startOfMonth(viewDate);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
  }
  return cells;
}

/**
 * Um único filtro de período: um campo que abre o calendário para escolher início e fim.
 */
export default function DateRangeFilter({
  from = '',
  to = '',
  onChange,
  label = 'Período',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseISO(from) || new Date());
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [picking, setPicking] = useState('from'); // from | to

  useEffect(() => {
    if (open) {
      setDraftFrom(from);
      setDraftTo(to);
      setViewDate(parseISO(from) || parseISO(to) || new Date());
      setPicking(from && !to ? 'to' : 'from');
    }
  }, [open, from, to]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const days = useMemo(() => buildMonthDays(viewDate), [viewDate]);
  const fromDate = parseISO(draftFrom);
  const toDate = parseISO(draftTo);

  const display = useMemo(() => {
    if (from && to) return `${formatBR(from)} — ${formatBR(to)}`;
    if (from) return `${formatBR(from)} — …`;
    if (to) return `… — ${formatBR(to)}`;
    return 'Selecionar período';
  }, [from, to]);

  function selectDay(date) {
    const iso = toISO(date);

    if (picking === 'from' || !draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso);
      setDraftTo('');
      setPicking('to');
      return;
    }

    if (iso < draftFrom) {
      setDraftFrom(iso);
      setDraftTo(draftFrom);
    } else {
      setDraftTo(iso);
    }
    setPicking('from');
  }

  function apply() {
    if (!draftFrom || !draftTo) return;
    onChange?.({ from: draftFrom, to: draftTo });
    setOpen(false);
  }

  function clear() {
    setDraftFrom('');
    setDraftTo('');
    setPicking('from');
    onChange?.({ from: '', to: '' });
    setOpen(false);
  }

  function isInRange(date) {
    if (!fromDate || !toDate) return false;
    const t = date.getTime();
    return t >= fromDate.getTime() && t <= toDate.getTime();
  }

  function isEdge(date) {
    return sameDay(date, fromDate) || sameDay(date, toDate);
  }

  return (
    <div className="date-range-filter" ref={rootRef}>
      {label && <span className="date-range-label">{label}</span>}

      <button
        type="button"
        className={`date-range-trigger ${open ? 'is-open' : ''} ${from || to ? 'has-value' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="date-range-trigger-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </span>
        <span className="date-range-trigger-text">{display}</span>
        <span className="date-range-trigger-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="date-range-popover">
          <div className="date-range-popover-hint">
            {picking === 'from' || !draftFrom
              ? 'Escolha a data inicial'
              : 'Escolha a data final'}
          </div>

          <div className="date-range-month-nav">
            <button type="button" onClick={() => setViewDate(addMonths(viewDate, -1))} aria-label="Mês anterior">
              ‹
            </button>
            <strong>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </strong>
            <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} aria-label="Próximo mês">
              ›
            </button>
          </div>

          <div className="date-range-weekdays">
            {WEEKDAYS.map((w, i) => (
              <span key={`${w}-${i}`}>{w}</span>
            ))}
          </div>

          <div className="date-range-grid">
            {days.map((date, idx) => {
              if (!date) return <span key={`e-${idx}`} className="date-range-day is-empty" />;
              const inRange = isInRange(date);
              const edge = isEdge(date);
              return (
                <button
                  key={toISO(date)}
                  type="button"
                  className={`date-range-day ${inRange ? 'in-range' : ''} ${edge ? 'is-edge' : ''}`}
                  onClick={() => selectDay(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="date-range-popover-footer">
            <button type="button" className="btn btn-sm btn-ghost" onClick={clear}>
              Limpar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!draftFrom || !draftTo}
              onClick={apply}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function firstDayOfMonth(date = new Date()) {
  return toISO(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function lastDayOfMonth(date = new Date()) {
  return toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function todayISO(date = new Date()) {
  return toISO(date);
}

/** Período padrão: mês atual (dia 1 até o último dia). */
export function currentMonthRange(date = new Date()) {
  return {
    from: firstDayOfMonth(date),
    to: lastDayOfMonth(date),
  };
}
