import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate, formatMoney, statusLabel } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import ResponsiveTable from '../components/ResponsiveTable';

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loans, setLoans] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [busyLoan, setBusyLoan] = useState('');
  const [confirm, setConfirm] = useState(null); // { type, loanId, code }

  const load = useCallback(async () => {
    try {
      const [p, allLoans, inst, txs] = await Promise.all([
        api.getPerson(id),
        api.getLoans(),
        api.getInstallments({ personId: id }),
        api.getTransactions({ personId: id }),
      ]);
      setPerson(p);
      setLoans(allLoans.filter((l) => l.personId === id));
      setInstallments(inst);
      setTransactions(txs);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runConfirmedAction() {
    if (!confirm) return;
    setBusyLoan(confirm.loanId);
    try {
      if (confirm.type === 'settle') {
        await api.settleLoan(confirm.loanId);
      } else {
        await api.cancelLoan(confirm.loanId);
      }
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyLoan('');
    }
  }

  if (error && !person) return <div className="error-banner">{error}</div>;
  if (!person) return <div className="loading">Carregando…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{person.name}</h1>
          <p>
            {person.contact || 'Sem contato'} · {person.document || 'Sem documento'}
          </p>
        </div>
        <Link className="btn btn-ghost" to="/clientes">
          ← Voltar
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid-stats">
        <div className="stat warning">
          <div className="label">Pendente</div>
          <div className="value">{formatMoney(person.totalPending)}</div>
        </div>
        <div className="stat danger">
          <div className="label">Atrasado</div>
          <div className="value">{formatMoney(person.totalOverdue)}</div>
        </div>
        <div className="stat success">
          <div className="label">Já pago</div>
          <div className="value">{formatMoney(person.totalPaid)}</div>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Dados</h2>
          <dl className="meta-list">
            <div>
              <dt>Endereço</dt>
              <dd>{person.address || '—'}</dd>
            </div>
            <div>
              <dt>Observações</dt>
              <dd>{person.notes || '—'}</dd>
            </div>
            <div>
              <dt>Empréstimos</dt>
              <dd>
                {person.activeLoans} ativos / {person.loansCount} total
              </dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Empréstimos</h2>
          {loans.length === 0 ? (
            <div className="empty">Nenhum empréstimo.</div>
          ) : (
            <ResponsiveTable>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Principal</th>
                    <th>Concessão</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className="loan-code">{l.code || l.id?.slice(0, 8)}</span>
                      </td>
                      <td>{formatMoney(l.principal)}</td>
                      <td>{formatDate(l.grantDate)}</td>
                      <td>
                        <span className={`badge badge-${l.status}`}>
                          {statusLabel(l.status)}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn btn-sm btn-ghost" to={`/emprestimos/${l.id}`}>
                            Detalhes
                          </Link>
                          {l.status === 'active' && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                disabled={busyLoan === l.id}
                                onClick={() =>
                                  setConfirm({
                                    type: 'settle',
                                    loanId: l.id,
                                    code: l.code || l.id?.slice(0, 8),
                                  })
                                }
                              >
                                Quitar
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                disabled={busyLoan === l.id}
                                onClick={() =>
                                  setConfirm({
                                    type: 'cancel',
                                    loanId: l.id,
                                    code: l.code || l.id?.slice(0, 8),
                                  })
                                }
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Parcelas</h2>
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vencimento</th>
                <th>Original</th>
                <th>Juros atraso</th>
                <th>A pagar</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((i) => (
                <tr key={i.id}>
                  <td>{i.number}</td>
                  <td>{formatDate(i.dueDate)}</td>
                  <td>{formatMoney(i.originalAmount)}</td>
                  <td>{formatMoney(i.lateInterestApplied)}</td>
                  <td>
                    {i.status === 'paid'
                      ? formatMoney(i.paidAmount)
                      : i.status === 'cancelled'
                        ? '—'
                        : formatMoney(i.amountDue)}
                  </td>
                  <td>
                    <StatusBadge status={i.status} daysLate={i.daysLate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>

      <div className="panel">
        <h2>Histórico de transações</h2>
        {transactions.length === 0 ? (
          <div className="empty">Sem transações.</div>
        ) : (
          <ResponsiveTable>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      {t.type === 'payment'
                        ? 'Recebimento'
                        : t.type === 'loan_settled'
                          ? 'Quitação'
                          : t.type === 'loan_cancelled'
                            ? 'Cancelamento'
                            : t.type === 'rate_update'
                              ? 'Atualização de taxas'
                              : 'Empréstimo'}
                    </td>
                    <td>{t.type === 'payment' || t.type === 'loan_settled' ? formatMoney(t.amount) : '—'}</td>
                    <td>{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>

      <ConfirmModal
        open={confirm?.type === 'settle'}
        title="Quitar empréstimo"
        message={`Quitar ${confirm?.code || 'este empréstimo'}? Todas as parcelas em aberto serão baixadas como pagas.`}
        confirmLabel="Sim, quitar"
        cancelLabel="Voltar"
        variant="success"
        loading={Boolean(busyLoan)}
        onCancel={() => !busyLoan && setConfirm(null)}
        onConfirm={runConfirmedAction}
      />
      <ConfirmModal
        open={confirm?.type === 'cancel'}
        title="Cancelar empréstimo"
        message={`Cancelar ${confirm?.code || 'este empréstimo'}? Todas as parcelas em aberto serão canceladas.`}
        confirmLabel="Sim, cancelar"
        cancelLabel="Voltar"
        variant="danger"
        loading={Boolean(busyLoan)}
        onCancel={() => !busyLoan && setConfirm(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}
