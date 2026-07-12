const { v4: uuidv4 } = require('uuid');
const {
  db,
  createLoanRecord,
  refreshLateInterest,
  markPaidInternal,
  checkLoanCompletion,
  round2,
  todayStr,
} = require('./db');

function getPerson(id) {
  return db.people.find((p) => p.id === id) || null;
}

function listPeople() {
  refreshLateInterest();
  return db.people.map((p) => enrichPerson(p));
}

function enrichPerson(person) {
  const installments = db.installments.filter(
    (i) => i.personId === person.id && i.status !== 'cancelled'
  );
  const pending = installments.filter((i) => i.status !== 'paid');
  const overdue = installments.filter((i) => i.status === 'overdue');
  const totalPending = round2(pending.reduce((s, i) => s + i.amountDue, 0));
  const totalOverdue = round2(overdue.reduce((s, i) => s + i.amountDue, 0));
  const totalPaid = round2(
    installments.filter((i) => i.status === 'paid').reduce((s, i) => s + i.paidAmount, 0)
  );
  const loans = db.loans.filter((l) => l.personId === person.id);

  return {
    ...person,
    loansCount: loans.length,
    activeLoans: loans.filter((l) => l.status === 'active').length,
    totalPending,
    totalOverdue,
    totalPaid,
    hasDebt: totalPending > 0,
  };
}

function createPerson(data) {
  const person = {
    id: uuidv4(),
    name: String(data.name || '').trim(),
    contact: String(data.contact || '').trim(),
    document: String(data.document || '').trim(),
    address: String(data.address || '').trim(),
    notes: String(data.notes || '').trim(),
    createdAt: new Date().toISOString(),
  };
  if (!person.name) throw new Error('Nome é obrigatório');
  db.people.push(person);
  return enrichPerson(person);
}

function updatePerson(id, data) {
  const person = getPerson(id);
  if (!person) throw new Error('Pessoa não encontrada');
  if (data.name !== undefined) person.name = String(data.name).trim();
  if (data.contact !== undefined) person.contact = String(data.contact).trim();
  if (data.document !== undefined) person.document = String(data.document).trim();
  if (data.address !== undefined) person.address = String(data.address).trim();
  if (data.notes !== undefined) person.notes = String(data.notes).trim();
  if (!person.name) throw new Error('Nome é obrigatório');
  return enrichPerson(person);
}

function deletePerson(id) {
  const idx = db.people.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Pessoa não encontrada');
  const hasActive = db.loans.some((l) => l.personId === id && l.status === 'active');
  if (hasActive) throw new Error('Não é possível excluir pessoa com empréstimos ativos');
  db.people.splice(idx, 1);
  return { ok: true };
}

function listLoans() {
  refreshLateInterest();
  return db.loans.map(enrichLoan);
}

function getLoan(id) {
  refreshLateInterest();
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) return null;
  return enrichLoan(loan);
}

function enrichLoan(loan) {
  const person = getPerson(loan.personId);
  const installments = db.installments
    .filter((i) => i.loanId === loan.id)
    .sort((a, b) => a.number - b.number)
    .map(enrichInstallment);

  const paid = installments.filter((i) => i.status === 'paid');
  const pending = installments.filter((i) => i.status === 'pending' || i.status === 'overdue');

  return {
    ...loan,
    personName: person?.name || '—',
    personContact: person?.contact || '',
    installments,
    totalPaid: round2(paid.reduce((s, i) => s + i.paidAmount, 0)),
    totalPending: round2(pending.reduce((s, i) => s + i.amountDue, 0)),
    paidCount: paid.length,
    pendingCount: pending.length,
  };
}

function createLoan(data) {
  const person = getPerson(data.personId);
  if (!person) throw new Error('Pessoa não encontrada');

  const principal = Number(data.principal);
  if (!principal || principal <= 0) throw new Error('Valor principal inválido');

  const grantDate = data.grantDate || todayStr();
  const interestRate = Number(data.interestRate);
  const lateInterestRate = Number(data.lateInterestRate);
  if (Number.isNaN(interestRate) || interestRate < 0) {
    throw new Error('Taxa de juros inválida');
  }
  if (Number.isNaN(lateInterestRate) || lateInterestRate < 0) {
    throw new Error('Taxa de juros por atraso inválida');
  }

  const isInstallment = Boolean(data.isInstallment);
  const installmentCount = isInstallment ? Number(data.installmentCount) : 1;
  if (isInstallment && (!installmentCount || installmentCount < 1)) {
    throw new Error('Número de parcelas inválido');
  }

  const loan = createLoanRecord({
    personId: data.personId,
    principal,
    grantDate,
    interestRate,
    lateInterestRate,
    isInstallment,
    installmentCount,
  });

  db.transactions.push({
    id: uuidv4(),
    type: 'loan_created',
    installmentId: null,
    loanId: loan.id,
    personId: loan.personId,
    amount: principal,
    date: grantDate,
    note: `Empréstimo ${loan.code} concedido — ${isInstallment ? installmentCount + 'x' : 'à vista'}`,
    createdAt: new Date().toISOString(),
  });

  return enrichLoan(loan);
}

/**
 * Atualiza taxas do empréstimo e recalcula apenas parcelas não pagas
 * (pendentes e atrasadas). Parcelas pagas permanecem intactas.
 */
function updateLoanRates(id, data) {
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) throw new Error('Empréstimo não encontrado');
  if (loan.status === 'cancelled') throw new Error('Não é possível alterar taxas de empréstimo cancelado');
  if (loan.status === 'completed') throw new Error('Não é possível alterar taxas de empréstimo quitado');

  const prevInterest = loan.interestRate;
  const prevLate = loan.lateInterestRate;

  if (data.interestRate !== undefined) {
    const interestRate = Number(data.interestRate);
    if (Number.isNaN(interestRate) || interestRate < 0) {
      throw new Error('Taxa de juros inválida');
    }
    loan.interestRate = interestRate;
  }

  if (data.lateInterestRate !== undefined) {
    const lateInterestRate = Number(data.lateInterestRate);
    if (Number.isNaN(lateInterestRate) || lateInterestRate < 0) {
      throw new Error('Taxa de juros por atraso inválida');
    }
    loan.lateInterestRate = lateInterestRate;
  }

  const installmentAmount = round2(
    (loan.principal / loan.installmentCount) * (1 + loan.interestRate / 100)
  );
  loan.installmentAmount = installmentAmount;

  let updatedCount = 0;
  for (const inst of db.installments) {
    if (inst.loanId !== loan.id) continue;
    if (inst.status === 'paid' || inst.status === 'cancelled') continue;

    inst.originalAmount = installmentAmount;
    inst.lateInterestApplied = 0;
    inst.amountDue = installmentAmount;
    updatedCount += 1;
  }

  // Reaplica juros de atraso nas vencidas com a nova taxa / novo valor original
  refreshLateInterest();

  db.transactions.push({
    id: uuidv4(),
    type: 'rate_update',
    installmentId: null,
    loanId: loan.id,
    personId: loan.personId,
    amount: 0,
    date: todayStr(),
    note: `Taxas atualizadas: juros ${prevInterest}% → ${loan.interestRate}%; atraso ${prevLate}% → ${loan.lateInterestRate}%/dia (${updatedCount} parcela(s) recalculada(s))`,
    createdAt: new Date().toISOString(),
  });

  return enrichLoan(loan);
}

/**
 * Quita o empréstimo: dá baixa em todas as parcelas em aberto
 * (pendentes/atrasadas), mantendo as já pagas.
 */
function settleLoan(id) {
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) throw new Error('Empréstimo não encontrado');
  if (loan.status === 'cancelled') throw new Error('Empréstimo cancelado não pode ser quitado');
  if (loan.status === 'completed') throw new Error('Empréstimo já está quitado');

  refreshLateInterest();

  const open = db.installments.filter(
    (i) => i.loanId === loan.id && (i.status === 'pending' || i.status === 'overdue')
  );

  let total = 0;
  for (const inst of open) {
    const tx = markPaidInternal(inst, todayStr(), `Quitação do empréstimo ${loan.code} — parcela #${inst.number}`);
    total = round2(total + tx.amount);
  }

  loan.status = 'completed';

  db.transactions.push({
    id: uuidv4(),
    type: 'loan_settled',
    installmentId: null,
    loanId: loan.id,
    personId: loan.personId,
    amount: total,
    date: todayStr(),
    note: `Empréstimo ${loan.code} quitado — ${open.length} parcela(s)`,
    createdAt: new Date().toISOString(),
  });

  return enrichLoan(loan);
}

/**
 * Cancela o empréstimo: cancela todas as parcelas em aberto.
 * Parcelas já pagas permanecem como pagas.
 */
function cancelLoan(id) {
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) throw new Error('Empréstimo não encontrado');
  if (loan.status === 'cancelled') throw new Error('Empréstimo já está cancelado');
  if (loan.status === 'completed') throw new Error('Empréstimo quitado não pode ser cancelado');

  const open = db.installments.filter(
    (i) => i.loanId === loan.id && (i.status === 'pending' || i.status === 'overdue')
  );

  for (const inst of open) {
    inst.status = 'cancelled';
    inst.lateInterestApplied = 0;
    inst.daysLate = 0;
    inst.amountDue = 0;
  }

  loan.status = 'cancelled';

  db.transactions.push({
    id: uuidv4(),
    type: 'loan_cancelled',
    installmentId: null,
    loanId: loan.id,
    personId: loan.personId,
    amount: 0,
    date: todayStr(),
    note: `Empréstimo ${loan.code} cancelado — ${open.length} parcela(s) cancelada(s)`,
    createdAt: new Date().toISOString(),
  });

  return enrichLoan(loan);
}

function enrichInstallment(inst) {
  const person = getPerson(inst.personId);
  const loan = db.loans.find((l) => l.id === inst.loanId);
  return {
    ...inst,
    daysLate: inst.daysLate || 0,
    personName: person?.name || '—',
    loanPrincipal: loan?.principal,
    lateInterestRate: loan?.lateInterestRate,
  };
}

function listInstallments(filters = {}) {
  refreshLateInterest();
  let list = db.installments.map(enrichInstallment);

  if (filters.status) {
    list = list.filter((i) => i.status === filters.status);
  }
  if (filters.personId) {
    list = list.filter((i) => i.personId === filters.personId);
  }
  if (filters.loanId) {
    list = list.filter((i) => i.loanId === filters.loanId);
  }
  if (filters.from) {
    list = list.filter((i) => i.dueDate >= filters.from);
  }
  if (filters.to) {
    list = list.filter((i) => i.dueDate <= filters.to);
  }
  if (!filters.from && !filters.to && filters.month && filters.year) {
    const m = String(filters.month).padStart(2, '0');
    const prefix = `${filters.year}-${m}`;
    list = list.filter((i) => i.dueDate.startsWith(prefix));
  }

  return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.number - b.number);
}

function payInstallment(id, { paidDate, note, advance } = {}) {
  refreshLateInterest();
  const inst = db.installments.find((i) => i.id === id);
  if (!inst) throw new Error('Parcela não encontrada');
  if (inst.status === 'paid') throw new Error('Parcela já está paga');
  if (inst.status === 'cancelled') throw new Error('Parcela cancelada');

  const date = paidDate || todayStr();
  const label = advance
    ? `Adiantamento parcela #${inst.number}`
    : note || `Baixa parcela #${inst.number}`;

  // Ao adiantar, se ainda não venceu, paga o valor original (sem juros de atraso)
  if (advance && inst.dueDate >= date) {
    inst.lateInterestApplied = 0;
    inst.amountDue = inst.originalAmount;
  }

  return markPaidInternal(inst, date, label);
}

function listTransactions(filters = {}) {
  let list = [...db.transactions];

  if (filters.type) list = list.filter((t) => t.type === filters.type);
  if (filters.personId) list = list.filter((t) => t.personId === filters.personId);
  if (filters.from) list = list.filter((t) => t.date >= filters.from);
  if (filters.to) list = list.filter((t) => t.date <= filters.to);

  return list
    .map((t) => {
      const person = getPerson(t.personId);
      return { ...t, personName: person?.name || '—' };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function getDashboard({ from, to, year, month } = {}) {
  refreshLateInterest();

  const now = new Date();
  let rangeFrom = from;
  let rangeTo = to;

  // Compatibilidade: se vier mês/ano sem range, converte
  if ((!rangeFrom || !rangeTo) && (year || month)) {
    const y = Number(year) || now.getFullYear();
    const m = Number(month) || now.getMonth() + 1;
    rangeFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(y, m, 0).getDate();
    rangeTo = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  if (!rangeFrom) {
    rangeFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  if (!rangeTo) {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    rangeTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  const payments = db.transactions.filter((t) => t.type === 'payment');
  const paymentsInRange = payments.filter((t) => t.date >= rangeFrom && t.date <= rangeTo);

  const receivedInPeriod = round2(paymentsInRange.reduce((s, t) => s + t.amount, 0));

  const unpaidInPeriod = db.installments.filter(
    (i) =>
      (i.status === 'pending' || i.status === 'overdue') &&
      i.dueDate >= rangeFrom &&
      i.dueDate <= rangeTo
  );
  const overdueAll = db.installments.filter((i) => i.status === 'overdue');
  const pendingAll = db.installments.filter(
    (i) => i.status === 'pending' || i.status === 'overdue'
  );

  const peopleWithDebt = listPeople().filter((p) => p.hasDebt);

  const cashFlowByMonth = {};
  for (const t of paymentsInRange) {
    const key = t.date.slice(0, 7);
    cashFlowByMonth[key] = round2((cashFlowByMonth[key] || 0) + t.amount);
  }

  return {
    period: { from: rangeFrom, to: rangeTo },
    receivedInPeriod,
    // aliases para telas antigas
    receivedMonth: receivedInPeriod,
    receivedYear: receivedInPeriod,
    unpaidInPeriod: {
      count: unpaidInPeriod.length,
      total: round2(unpaidInPeriod.reduce((s, i) => s + i.amountDue, 0)),
      items: unpaidInPeriod.map(enrichInstallment).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    },
    unpaidMonth: {
      count: unpaidInPeriod.length,
      total: round2(unpaidInPeriod.reduce((s, i) => s + i.amountDue, 0)),
      items: unpaidInPeriod.map(enrichInstallment).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    },
    unpaidYear: {
      count: unpaidInPeriod.length,
      total: round2(unpaidInPeriod.reduce((s, i) => s + i.amountDue, 0)),
    },
    overdue: {
      count: overdueAll.length,
      total: round2(overdueAll.reduce((s, i) => s + i.amountDue, 0)),
      lateInterestTotal: round2(overdueAll.reduce((s, i) => s + i.lateInterestApplied, 0)),
    },
    pending: {
      count: pendingAll.length,
      total: round2(pendingAll.reduce((s, i) => s + i.amountDue, 0)),
    },
    peopleWithDebt: peopleWithDebt.map((p) => ({
      id: p.id,
      name: p.name,
      contact: p.contact,
      totalPending: p.totalPending,
      totalOverdue: p.totalOverdue,
    })),
    cashFlowByMonth: Object.entries(cashFlowByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, total]) => ({ month: monthKey, total })),
    recentTransactions: listTransactions({ from: rangeFrom, to: rangeTo }).slice(0, 20),
    totals: {
      people: db.people.length,
      activeLoans: db.loans.filter((l) => l.status === 'active').length,
      loans: db.loans.length,
    },
  };
}

function getCashFlowReport({ from, to } = {}) {
  const payments = listTransactions({ type: 'payment', from, to });
  const total = round2(payments.reduce((s, t) => s + t.amount, 0));

  const byPerson = {};
  for (const t of payments) {
    if (!byPerson[t.personId]) {
      byPerson[t.personId] = { personId: t.personId, personName: t.personName, total: 0, count: 0 };
    }
    byPerson[t.personId].total = round2(byPerson[t.personId].total + t.amount);
    byPerson[t.personId].count += 1;
  }

  return {
    from: from || null,
    to: to || null,
    total,
    count: payments.length,
    byPerson: Object.values(byPerson).sort((a, b) => b.total - a.total),
    transactions: payments,
  };
}

module.exports = {
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
};
