const express = require('express');
const {
  listPeople,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
  enrichPerson,
  listLoans,
  getLoan,
  createLoan,
  updateLoanRates,
  settleLoan,
  cancelLoan,
  listInstallments,
  payInstallment,
  listTransactions,
  getDashboard,
  getCashFlowReport,
  refreshLateInterest,
} = require('./services');
const { seed } = require('./db');
const { login, logout, authMiddleware } = require('./auth');

const router = express.Router();

function handle(fn) {
  return (req, res) => {
    try {
      const result = fn(req, res);
      if (result !== undefined) res.json(result);
    } catch (err) {
      const status = err.message.includes('não encontrad')
        ? 404
        : err.message.includes('inválidos')
          ? 401
          : 400;
      res.status(status).json({ error: err.message });
    }
  };
}

// Auth (público)
router.post(
  '/auth/login',
  handle((req) => login(req.body?.email, req.body?.password))
);
router.post(
  '/auth/logout',
  authMiddleware,
  handle((req) => logout(req.token))
);
router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Demais rotas exigem autenticação
router.use(authMiddleware);

// Pessoas
router.get(
  '/people',
  handle(() => listPeople())
);
router.get(
  '/people/:id',
  handle((req) => {
    const p = getPerson(req.params.id);
    if (!p) throw new Error('Pessoa não encontrada');
    refreshLateInterest();
    return enrichPerson(p);
  })
);
router.post(
  '/people',
  handle((req) => createPerson(req.body))
);
router.put(
  '/people/:id',
  handle((req) => updatePerson(req.params.id, req.body))
);
router.delete(
  '/people/:id',
  handle((req) => deletePerson(req.params.id))
);

// Empréstimos
router.get(
  '/loans',
  handle(() => listLoans())
);
router.get(
  '/loans/:id',
  handle((req) => {
    const loan = getLoan(req.params.id);
    if (!loan) throw new Error('Empréstimo não encontrado');
    return loan;
  })
);
router.post(
  '/loans',
  handle((req) => createLoan(req.body))
);
router.put(
  '/loans/:id/rates',
  handle((req) => updateLoanRates(req.params.id, req.body))
);
router.post(
  '/loans/:id/settle',
  handle((req) => settleLoan(req.params.id))
);
router.post(
  '/loans/:id/cancel',
  handle((req) => cancelLoan(req.params.id))
);

// Parcelas
router.get(
  '/installments',
  handle((req) =>
    listInstallments({
      status: req.query.status,
      personId: req.query.personId,
      loanId: req.query.loanId,
      from: req.query.from,
      to: req.query.to,
      month: req.query.month,
      year: req.query.year,
    })
  )
);
router.post(
  '/installments/:id/pay',
  handle((req) =>
    payInstallment(req.params.id, {
      paidDate: req.body.paidDate,
      note: req.body.note,
      advance: Boolean(req.body.advance),
    })
  )
);
router.post(
  '/installments/refresh-interest',
  handle(() => {
    refreshLateInterest();
    return { ok: true, message: 'Juros de atraso recalculados' };
  })
);

// Transações / histórico
router.get(
  '/transactions',
  handle((req) =>
    listTransactions({
      type: req.query.type,
      personId: req.query.personId,
      from: req.query.from,
      to: req.query.to,
    })
  )
);

// Dashboard e relatórios
router.get(
  '/dashboard',
  handle((req) =>
    getDashboard({
      from: req.query.from,
      to: req.query.to,
      year: req.query.year,
      month: req.query.month,
    })
  )
);
router.get(
  '/reports/cashflow',
  handle((req) =>
    getCashFlowReport({
      from: req.query.from,
      to: req.query.to,
    })
  )
);

// Seed / util
router.post(
  '/seed',
  handle(() => {
    const result = seed();
    return { ok: true, message: 'Dados de exemplo carregados', ...result };
  })
);

module.exports = router;
