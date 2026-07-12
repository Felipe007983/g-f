import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatMoney } from '../api';
import DateRangeFilter, { currentMonthRange } from '../components/DateRangeFilter';
import StatusBadge from '../components/StatusBadge';
import ResponsiveTable from '../components/ResponsiveTable';

const defaultRange = currentMonthRange();

export default function Installments() {
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (status) params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      setItems(await api.getInstallments(params));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status, from, to]);

  async function pay(id, advance) {
    setBusy(id);
    try {
      await api.payInstallment(id, { advance });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    try {
      await api.refreshInterest();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Parcelas</h1>
          <p>Gerencie baixas, adiantamentos e acompanhe atrasos com juros.</p>
        </div>
        <button className="btn btn-ghost" onClick={refresh}>
          Recalcular juros
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="overdue">Atrasada</option>
            <option value="paid">Paga</option>
          </select>
        </label>
        <DateRangeFilter
          label="Período"
          from={from}
          to={to}
          onChange={({ from: f, to: t }) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={() => {
            const range = currentMonthRange();
            setStatus('');
            setFrom(range.from);
            setTo(range.to);
          }}
        >
          Limpar filtros
        </button>
      </div>

      <div className="panel">
        {loading ? (
          <div className="loading">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="empty">Nenhuma parcela encontrada.</div>
        ) : (
          <ResponsiveTable>
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>#</th>
                  <th>Vencimento</th>
                  <th>Original</th>
                  <th>Juros atraso</th>
                  <th>A pagar</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link className="linkish" to={`/clientes/${i.personId}`}>
                        {i.personName}
                      </Link>
                    </td>
                    <td>{i.number}</td>
                    <td>{formatDate(i.dueDate)}</td>
                    <td>{formatMoney(i.originalAmount)}</td>
                    <td>{formatMoney(i.lateInterestApplied)}</td>
                    <td>
                      {i.status === 'paid'
                        ? formatMoney(i.paidAmount)
                        : formatMoney(i.amountDue)}
                    </td>
                    <td>
                      <StatusBadge status={i.status} daysLate={i.daysLate} />
                    </td>
                    <td>
                      {i.status !== 'paid' ? (
                        <div className="row-actions">
                          <button
                            className="btn btn-sm btn-success"
                            disabled={busy === i.id}
                            onClick={() => pay(i.id, false)}
                          >
                            Dar baixa
                          </button>
                          {i.status === 'pending' && (
                            <button
                              className="btn btn-sm btn-ghost"
                              disabled={busy === i.id}
                              onClick={() => pay(i.id, true)}
                            >
                              Adiantar
                            </button>
                          )}
                          <Link
                            className="btn btn-sm btn-ghost"
                            to={`/emprestimos/${i.loanId}`}
                          >
                            Empréstimo
                          </Link>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                          Pago em {formatDate(i.paidAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>
    </div>
  );
}
