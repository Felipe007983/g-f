import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate, formatMoney, statusLabel } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import ResponsiveTable from '../components/ResponsiveTable';

export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(null);
  const [actionBusy, setActionBusy] = useState('');
  const [savingRates, setSavingRates] = useState(false);
  const [rates, setRates] = useState({ interestRate: '', lateInterestRate: '' });
  const [confirmAction, setConfirmAction] = useState(null); // settle | cancel

  async function load() {
    try {
      const data = await api.getLoan(id);
      setLoan(data);
      setRates({
        interestRate: String(data.interestRate),
        lateInterestRate: String(data.lateInterestRate),
      });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function pay(installmentId, advance = false) {
    setBusy(installmentId);
    setSuccess('');
    try {
      await api.payInstallment(installmentId, {
        advance,
        note: advance ? 'Adiantamento' : 'Baixa manual',
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    const action = confirmAction;
    setActionBusy(action);
    setError('');
    setSuccess('');
    try {
      if (action === 'settle') {
        const updated = await api.settleLoan(id);
        setLoan(updated);
        setSuccess(
          `Empréstimo ${updated.code || ''} quitado. Parcelas em aberto foram pagas.`
        );
      } else {
        const updated = await api.cancelLoan(id);
        setLoan(updated);
        setSuccess(`Empréstimo ${updated.code || ''} cancelado.`);
      }
      setConfirmAction(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setActionBusy('');
    }
  }

  async function saveRates(e) {
    e.preventDefault();
    setSavingRates(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api.updateLoanRates(id, {
        interestRate: Number(rates.interestRate),
        lateInterestRate: Number(rates.lateInterestRate),
      });
      setLoan(updated);
      setRates({
        interestRate: String(updated.interestRate),
        lateInterestRate: String(updated.lateInterestRate),
      });
      const unpaid = updated.installments.filter(
        (i) => i.status === 'pending' || i.status === 'overdue'
      ).length;
      setSuccess(
        `Taxas salvas. ${unpaid} parcela(s) em aberto foram recalculadas. Parcelas pagas não foram alteradas.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRates(false);
    }
  }

  if (error && !loan) return <div className="error-banner">{error}</div>;
  if (!loan) return <div className="loading">Carregando…</div>;

  const ratesChanged =
    Number(rates.interestRate) !== loan.interestRate ||
    Number(rates.lateInterestRate) !== loan.lateInterestRate;
  const isActive = loan.status === 'active';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Empréstimo — {loan.personName}</h1>
          <p>
            <span className="loan-code">{loan.code || loan.id?.slice(0, 8)}</span> ·{' '}
            {formatMoney(loan.principal)} ·{' '}
            {formatDate(loan.grantDate)} ·{' '}
            {loan.isInstallment ? `${loan.installmentCount} parcelas` : 'À vista'}
          </p>
        </div>
        <div className="actions">
          {isActive && (
            <>
              <button
                className="btn btn-success"
                disabled={Boolean(actionBusy)}
                onClick={() => setConfirmAction('settle')}
              >
                Quitar empréstimo
              </button>
              <button
                className="btn btn-danger"
                disabled={Boolean(actionBusy)}
                onClick={() => setConfirmAction('cancel')}
              >
                Cancelar empréstimo
              </button>
            </>
          )}
          <Link className="btn btn-ghost" to="/emprestimos">
            ← Voltar
          </Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="grid-stats">
        <div className="stat">
          <div className="label">ID do empréstimo</div>
          <div className="value" style={{ fontSize: '1.05rem' }}>
            {loan.code || loan.id?.slice(0, 8)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>
            <span className={`badge badge-${loan.status}`}>{statusLabel(loan.status)}</span>
          </div>
        </div>
        <div className="stat success">
          <div className="label">Recebido</div>
          <div className="value">{formatMoney(loan.totalPaid)}</div>
          <div className="hint">
            {loan.paidCount}/{loan.installmentCount} parcelas
          </div>
        </div>
        <div className="stat warning">
          <div className="label">Pendente</div>
          <div className="value">{formatMoney(loan.totalPending)}</div>
        </div>
        <div className="stat">
          <div className="label">Juros / Atraso</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>
            {loan.interestRate}% / {loan.lateInterestRate}% dia
          </div>
        </div>
      </div>

      {isActive && (
        <div className="panel">
          <h2>Editar taxas e recalcular</h2>
          <p className="panel-hint">
            Ao salvar, o valor das parcelas <strong>pendentes</strong> e <strong>atrasadas</strong> é
            recalculado com a nova taxa. Parcelas <strong>já pagas</strong> não mudam.
          </p>
          <form className="rates-form" onSubmit={saveRates}>
            <label>
              Taxa de juros (%)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={rates.interestRate}
                onChange={(e) => setRates({ ...rates, interestRate: e.target.value })}
              />
            </label>
            <label>
              Juros por atraso (% ao dia)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={rates.lateInterestRate}
                onChange={(e) => setRates({ ...rates, lateInterestRate: e.target.value })}
              />
            </label>
            <div className="rates-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingRates || !ratesChanged}
              >
                {savingRates ? 'Recalculando…' : 'Salvar e recalcular parcelas'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                <th>A pagar / Pago</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loan.installments.map((i) => (
                <tr
                  key={i.id}
                  className={
                    i.status === 'paid' || i.status === 'cancelled' ? 'row-paid' : ''
                  }
                >
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
                    {i.paidAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        em {formatDate(i.paidAt)}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={i.status} daysLate={i.daysLate} />
                  </td>
                  <td>
                    {(i.status === 'pending' || i.status === 'overdue') && (
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
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>

      <ConfirmModal
        open={confirmAction === 'settle'}
        title="Quitar empréstimo"
        message="Todas as parcelas em aberto serão baixadas como pagas. Esta ação não pode ser desfeita."
        confirmLabel="Sim, quitar"
        cancelLabel="Voltar"
        variant="success"
        loading={actionBusy === 'settle'}
        onCancel={() => !actionBusy && setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
      <ConfirmModal
        open={confirmAction === 'cancel'}
        title="Cancelar empréstimo"
        message="Todas as parcelas em aberto serão canceladas. Parcelas já pagas não mudam."
        confirmLabel="Sim, cancelar"
        cancelLabel="Voltar"
        variant="danger"
        loading={actionBusy === 'cancel'}
        onCancel={() => !actionBusy && setConfirmAction(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}
