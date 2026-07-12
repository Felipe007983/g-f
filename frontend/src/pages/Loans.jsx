import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatMoney, statusLabel } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import ResponsiveTable from '../components/ResponsiveTable';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  personId: '',
  principal: '',
  grantDate: today(),
  interestRate: '10',
  lateInterestRate: '5',
  isInstallment: true,
  installmentCount: '3',
};

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [l, p] = await Promise.all([api.getLoans(), api.getPeople()]);
      setLoans(l);
      setPeople(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.personId) {
      setError('Selecione um cliente');
      return;
    }
    try {
      await api.createLoan({
        ...form,
        principal: Number(form.principal),
        interestRate: Number(form.interestRate),
        lateInterestRate: Number(form.lateInterestRate),
        installmentCount: Number(form.installmentCount),
      });
      setOpen(false);
      setForm({ ...emptyForm, grantDate: today() });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Empréstimos</h1>
          <p>Conceda empréstimos à vista ou parcelados — as parcelas são geradas automaticamente.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({
              ...emptyForm,
              grantDate: today(),
              personId: '',
            });
            setOpen(true);
          }}
        >
          Novo empréstimo
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        {loading ? (
          <div className="loading">Carregando…</div>
        ) : loans.length === 0 ? (
          <div className="empty">Nenhum empréstimo cadastrado.</div>
        ) : (
          <ResponsiveTable>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Principal</th>
                  <th>Concessão</th>
                  <th>Tipo</th>
                  <th>Juros</th>
                  <th>Atraso</th>
                  <th>Pendente</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className="loan-code">{l.code}</span>
                    </td>
                    <td>
                      <Link className="linkish" to={`/clientes/${l.personId}`}>
                        {l.personName}
                      </Link>
                    </td>
                    <td>{formatMoney(l.principal)}</td>
                    <td>{formatDate(l.grantDate)}</td>
                    <td>
                      {l.isInstallment ? `${l.installmentCount}x` : 'À vista'}
                    </td>
                    <td>{l.interestRate}%</td>
                    <td>{l.lateInterestRate}%/dia</td>
                    <td>{formatMoney(l.totalPending)}</td>
                    <td>
                      <span className={`badge badge-${l.status}`}>
                        {statusLabel(l.status)}
                      </span>
                    </td>
                    <td>
                      <Link className="linkish" to={`/emprestimos/${l.id}`}>
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Novo empréstimo</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="full">
                  Cliente *
                  <SearchableSelect
                    required
                    options={people}
                    value={form.personId}
                    onChange={(personId) => setForm({ ...form, personId })}
                    placeholder="Digite para buscar o cliente…"
                    getOptionLabel={(p) => p.name}
                    getOptionValue={(p) => p.id}
                    getOptionMeta={(p) => p.contact || p.document || ''}
                  />
                </label>
                <label>
                  Valor principal (R$) *
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={form.principal}
                    onChange={(e) => setForm({ ...form, principal: e.target.value })}
                  />
                </label>
                <label>
                  Data de concessão *
                  <input
                    type="date"
                    required
                    value={form.grantDate}
                    onChange={(e) => setForm({ ...form, grantDate: e.target.value })}
                  />
                </label>
                <label>
                  Taxa de juros (%) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                  />
                </label>
                <label>
                  Juros por atraso (% ao dia) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.lateInterestRate}
                    onChange={(e) => setForm({ ...form, lateInterestRate: e.target.value })}
                  />
                </label>
                <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.isInstallment}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isInstallment: e.target.checked,
                        installmentCount: e.target.checked ? form.installmentCount || '3' : '1',
                      })
                    }
                  />
                  Parcelado
                </label>
                {form.isInstallment && (
                  <label>
                    Número de parcelas *
                    <input
                      type="number"
                      min="1"
                      max="60"
                      required
                      value={form.installmentCount}
                      onChange={(e) => setForm({ ...form, installmentCount: e.target.value })}
                    />
                  </label>
                )}
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
                Cada parcela = (principal ÷ N) × (1 + juros%). Vencimentos mensais a partir da
                concessão. Juros de atraso = valor original × taxa/dia × dias em atraso.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar empréstimo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
