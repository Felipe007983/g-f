const BASE = '/api';
const TOKEN_KEY = 'fg_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }

  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request('/auth/logout', { method: 'POST', body: '{}' }),
  me: () => request('/auth/me'),
  getDashboard: (from, to) => {
    const q = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
    return request(`/dashboard${q ? `?${q}` : ''}`);
  },
  getPeople: () => request('/people'),
  getPerson: (id) => request(`/people/${id}`),
  createPerson: (body) => request('/people', { method: 'POST', body: JSON.stringify(body) }),
  updatePerson: (id, body) =>
    request(`/people/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePerson: (id) => request(`/people/${id}`, { method: 'DELETE' }),
  getLoans: () => request('/loans'),
  getLoan: (id) => request(`/loans/${id}`),
  createLoan: (body) => request('/loans', { method: 'POST', body: JSON.stringify(body) }),
  updateLoanRates: (id, body) =>
    request(`/loans/${id}/rates`, { method: 'PUT', body: JSON.stringify(body) }),
  settleLoan: (id) => request(`/loans/${id}/settle`, { method: 'POST', body: '{}' }),
  cancelLoan: (id) => request(`/loans/${id}/cancel`, { method: 'POST', body: '{}' }),
  getInstallments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/installments${q ? `?${q}` : ''}`);
  },
  payInstallment: (id, body = {}) =>
    request(`/installments/${id}/pay`, { method: 'POST', body: JSON.stringify(body) }),
  refreshInterest: () =>
    request('/installments/refresh-interest', { method: 'POST', body: '{}' }),
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/transactions${q ? `?${q}` : ''}`);
  },
  getCashFlow: (from, to) => {
    const q = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
    return request(`/reports/cashflow${q ? `?${q}` : ''}`);
  },
  seed: () => request('/seed', { method: 'POST', body: '{}' }),
};

export function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function statusLabel(status) {
  const map = {
    pending: 'Pendente',
    overdue: 'Atrasada',
    paid: 'Paga',
    cancelled: 'Cancelado',
    active: 'Ativo',
    completed: 'Quitado',
  };
  return map[status] || status;
}

export function daysLateLabel(days) {
  const n = Number(days) || 0;
  if (n <= 0) return '';
  return n === 1 ? '1 dia' : `${n} dias`;
}
