import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../api';

const emptyForm = {
  name: '',
  contact: '',
  document: '',
  address: '',
  notes: '',
};

export default function People() {
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [onlyDebt, setOnlyDebt] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setPeople(await api.getPeople());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p) {
    setEditId(p.id);
    setForm({
      name: p.name,
      contact: p.contact,
      document: p.document,
      address: p.address,
      notes: p.notes || '',
    });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editId) await api.updatePerson(editId, form);
      else await api.createPerson(form);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!confirm('Excluir este cliente?')) return;
    try {
      await api.deletePerson(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const list = onlyDebt ? people.filter((p) => p.hasDebt) : people;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p>Cadastro de clientes e visão de quem está com débito.</p>
        </div>
        <div className="actions">
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={onlyDebt}
              onChange={(e) => setOnlyDebt(e.target.checked)}
            />
            Só com débito
          </label>
          <button className="btn btn-primary" onClick={openCreate}>
            Novo cliente
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        {loading ? (
          <div className="loading">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="empty">Nenhum cliente encontrado.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Documento</th>
                  <th>Pendente</th>
                  <th>Atrasado</th>
                  <th>Empréstimos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="linkish" to={`/clientes/${p.id}`}>
                        {p.name}
                      </Link>
                    </td>
                    <td>{p.contact || '—'}</td>
                    <td>{p.document || '—'}</td>
                    <td>{formatMoney(p.totalPending)}</td>
                    <td style={{ color: p.totalOverdue ? 'var(--danger)' : undefined }}>
                      {formatMoney(p.totalOverdue)}
                    </td>
                    <td>
                      {p.activeLoans}/{p.loansCount}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}>
                          Editar
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'Editar cliente' : 'Novo cliente'}</h2>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="full">
                  Nome *
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Contato
                  <input
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  />
                </label>
                <label>
                  Documento
                  <input
                    value={form.document}
                    onChange={(e) => setForm({ ...form, document: e.target.value })}
                  />
                </label>
                <label className="full">
                  Endereço
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <label className="full">
                  Observações
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
