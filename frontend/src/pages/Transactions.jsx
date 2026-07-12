import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatMoney } from '../api';
import DateRangeFilter, { currentMonthRange } from '../components/DateRangeFilter';
import ResponsiveTable from '../components/ResponsiveTable';

const defaultRange = currentMonthRange();

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (type) params.type = type;
      if (from) params.from = from;
      if (to) params.to = to;
      setItems(await api.getTransactions(params));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [type, from, to]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Histórico</h1>
          <p>Todas as transações: concessões de empréstimo e recebimentos.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            <option value="payment">Recebimentos</option>
            <option value="loan_created">Empréstimos</option>
            <option value="rate_update">Atualização de taxas</option>
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
            setType('');
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
          <div className="empty">Nenhuma transação.</div>
        ) : (
          <ResponsiveTable>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      <Link className="linkish" to={`/clientes/${t.personId}`}>
                        {t.personName}
                      </Link>
                    </td>
                    <td>
                      {t.type === 'payment'
                        ? 'Recebimento'
                        : t.type === 'rate_update'
                          ? 'Atualização de taxas'
                          : 'Empréstimo concedido'}
                    </td>
                    <td
                      style={{
                        color: t.type === 'payment' ? 'var(--success)' : 'var(--muted)',
                        fontWeight: 600,
                      }}
                    >
                      {t.type === 'payment' ? '+' : t.type === 'rate_update' ? '' : '−'}
                      {t.type === 'rate_update' ? '—' : formatMoney(t.amount)}
                    </td>
                    <td>{t.note}</td>
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
