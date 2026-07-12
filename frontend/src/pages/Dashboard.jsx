import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatMoney } from '../api';
import DateRangeFilter, { currentMonthRange } from '../components/DateRangeFilter';
import StatusBadge from '../components/StatusBadge';
import ResponsiveTable from '../components/ResponsiveTable';

const defaultRange = currentMonthRange();

export default function Dashboard() {
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await api.getDashboard(from, to);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [from, to]);

  if (loading && !data) return <div className="loading">Carregando dashboard…</div>;
  if (error && !data) return <div className="error-banner">{error}</div>;

  const maxCash = Math.max(...(data?.cashFlowByMonth?.map((c) => c.total) || [1]), 1);
  const unpaid = data.unpaidInPeriod || data.unpaidMonth;
  const received = data.receivedInPeriod ?? data.receivedMonth;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral de recebimentos, atrasos e débitos.</p>
        </div>
        <div className="actions filters" style={{ marginBottom: 0 }}>
          <DateRangeFilter
            label="Período"
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => {
              setFrom(f);
              setTo(t);
            }}
          />
          <button className="btn btn-ghost" onClick={load}>
            Atualizar
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid-stats">
        <div className="stat success">
          <div className="label">Recebido no período</div>
          <div className="value">{formatMoney(received)}</div>
        </div>
        <div className="stat warning">
          <div className="label">Não pago no período</div>
          <div className="value">{formatMoney(unpaid.total)}</div>
          <div className="hint">{unpaid.count} parcela(s)</div>
        </div>
        <div className="stat danger">
          <div className="label">Em atraso (total)</div>
          <div className="value">{formatMoney(data.overdue.total)}</div>
          <div className="hint">
            Juros atraso: {formatMoney(data.overdue.lateInterestTotal)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Pendente geral</div>
          <div className="value">{formatMoney(data.pending.total)}</div>
          <div className="hint">{data.pending.count} parcela(s)</div>
        </div>
        <div className="stat">
          <div className="label">Empréstimos ativos</div>
          <div className="value">{data.totals.activeLoans}</div>
          <div className="hint">{data.totals.people} clientes cadastrados</div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Parcelas não pagas no período</h2>
          {unpaid.items.length === 0 ? (
            <div className="empty">Nenhuma parcela pendente neste período.</div>
          ) : (
            <ResponsiveTable>
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link className="linkish" to={`/clientes/${i.personId}`}>
                          {i.personName}
                        </Link>
                      </td>
                      <td>#{i.number}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td>{formatMoney(i.amountDue)}</td>
                      <td>
                        <StatusBadge status={i.status} daysLate={i.daysLate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </div>

        <div className="panel">
          <h2>Clientes com débito</h2>
          {data.peopleWithDebt.length === 0 ? (
            <div className="empty">Ninguém com débito no momento.</div>
          ) : (
            <ResponsiveTable>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Pendente</th>
                    <th>Atrasado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.peopleWithDebt.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="linkish" to={`/clientes/${p.id}`}>
                          {p.name}
                        </Link>
                      </td>
                      <td>{formatMoney(p.totalPending)}</td>
                      <td style={{ color: p.totalOverdue ? 'var(--danger)' : undefined }}>
                        {formatMoney(p.totalOverdue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>
            Fluxo de caixa ({formatDate(data.period?.from || from)} —{' '}
            {formatDate(data.period?.to || to)})
          </h2>
          {data.cashFlowByMonth.length === 0 ? (
            <div className="empty">Sem recebimentos neste período.</div>
          ) : (
            <div className="bar-chart">
              {data.cashFlowByMonth.map((c) => (
                <div className="bar-row" key={c.month}>
                  <span>
                    {c.month.slice(5)}/{c.month.slice(2, 4)}
                  </span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(c.total / maxCash) * 100}%` }}
                    />
                  </div>
                  <span>{formatMoney(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Últimas transações do período</h2>
          {data.recentTransactions.length === 0 ? (
            <div className="empty">Sem transações.</div>
          ) : (
            <ResponsiveTable>
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.slice(0, 8).map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.personName}</td>
                      <td>
                        {t.type === 'payment'
                          ? 'Recebimento'
                          : t.type === 'rate_update'
                            ? 'Taxas'
                            : 'Empréstimo'}
                      </td>
                      <td
                        style={{
                          color: t.type === 'payment' ? 'var(--success)' : 'var(--muted)',
                        }}
                      >
                        {t.type === 'payment' ? '+' : ''}
                        {t.type === 'rate_update' ? '—' : formatMoney(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <Link className="linkish" to="/transacoes">
              Ver histórico completo →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
