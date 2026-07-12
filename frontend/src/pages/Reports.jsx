import { useEffect, useState } from 'react';
import { api, formatDate, formatMoney } from '../api';
import DateRangeFilter, { currentMonthRange } from '../components/DateRangeFilter';
import ResponsiveTable from '../components/ResponsiveTable';

const defaultRange = currentMonthRange();

export default function Reports() {
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setReport(await api.getCashFlow(from, to));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [from, to]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fluxo de caixa</h1>
          <p>Relatório de entradas (recebimentos) por período.</p>
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
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && !report ? (
        <div className="loading">Carregando…</div>
      ) : report ? (
        <>
          <div className="grid-stats">
            <div className="stat success">
              <div className="label">Total recebido</div>
              <div className="value">{formatMoney(report.total)}</div>
            </div>
            <div className="stat">
              <div className="label">Quantidade de pagamentos</div>
              <div className="value">{report.count}</div>
            </div>
            <div className="stat">
              <div className="label">Período</div>
              <div className="value" style={{ fontSize: '1rem' }}>
                {formatDate(report.from)} — {formatDate(report.to)}
              </div>
            </div>
          </div>

          <div className="panel-grid">
            <div className="panel">
              <h2>Por cliente</h2>
              {report.byPerson.length === 0 ? (
                <div className="empty">Sem recebimentos no período.</div>
              ) : (
                <ResponsiveTable>
                  <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Pagamentos</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byPerson.map((p) => (
                      <tr key={p.personId}>
                        <td>{p.personName}</td>
                        <td>{p.count}</td>
                        <td>{formatMoney(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </div>

            <div className="panel">
              <h2>Detalhamento</h2>
              {report.transactions.length === 0 ? (
                <div className="empty">Sem lançamentos.</div>
              ) : (
                <ResponsiveTable style={{ maxHeight: 420, overflow: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{formatDate(t.date)}</td>
                          <td>{t.personName}</td>
                          <td>{formatMoney(t.amount)}</td>
                          <td>{t.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
