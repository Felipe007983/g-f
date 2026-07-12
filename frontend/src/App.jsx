import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Dashboard from './pages/Dashboard';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import Loans from './pages/Loans';
import LoanDetail from './pages/LoanDetail';
import Installments from './pages/Installments';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Login from './pages/Login';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Carregando…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  return (
    <div className={`app-shell ${menuOpen ? 'nav-open' : ''}`}>
      <header className="mobile-topbar">
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-topbar-brand">
          <span className="brand-mark">G&F</span>
          <strong>G&F Financeiro</strong>
        </div>
        <button type="button" className="btn btn-sm btn-ghost mobile-logout" onClick={logout}>
          Sair
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G&F</span>
          <div>
            <strong>G&F Financeiro</strong>
            <small>Gestão de empréstimos</small>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/emprestimos">Empréstimos</NavLink>
          <NavLink to="/parcelas">Parcelas</NavLink>
          <NavLink to="/transacoes">Histórico</NavLink>
          <NavLink to="/relatorios">Fluxo de caixa</NavLink>
        </nav>
        <div className="sidebar-user">
          <div>
            <strong>{user?.name || 'Admin'}</strong>
            <small>{user?.email}</small>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
        <p className="sidebar-note">Banco em memória — dados reiniciam com o servidor.</p>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<People />} />
          <Route path="/clientes/:id" element={<PersonDetail />} />
          <Route path="/emprestimos" element={<Loans />} />
          <Route path="/emprestimos/:id" element={<LoanDetail />} />
          <Route path="/parcelas" element={<Installments />} />
          <Route path="/transacoes" element={<Transactions />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
