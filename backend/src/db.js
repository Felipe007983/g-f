/**
 * Banco de dados em memória.
 * Dados são perdidos ao reiniciar o servidor — adequado para protótipo/demo.
 */

const { v4: uuidv4 } = require('uuid');

const db = {
  people: [],
  loans: [],
  installments: [],
  transactions: [],
};

function reset() {
  db.people = [];
  db.loans = [];
  db.installments = [];
  db.transactions = [];
}

function seed() {
  reset();

  const p1 = {
    id: uuidv4(),
    name: 'João Silva',
    contact: '(11) 98765-4321',
    document: '123.456.789-00',
    address: 'Rua das Flores, 100 - São Paulo/SP',
    notes: 'Cliente antigo, bom pagador',
    createdAt: new Date().toISOString(),
  };

  const p2 = {
    id: uuidv4(),
    name: 'Maria Oliveira',
    contact: '(11) 91234-5678',
    document: '987.654.321-00',
    address: 'Av. Brasil, 500 - São Paulo/SP',
    notes: '',
    createdAt: new Date().toISOString(),
  };

  const p3 = {
    id: uuidv4(),
    name: 'Carlos Souza',
    contact: '(21) 99876-5432',
    document: '456.789.123-00',
    address: 'Rua do Comércio, 22 - Rio de Janeiro/RJ',
    notes: 'Já atrasou duas vezes',
    createdAt: new Date().toISOString(),
  };

  db.people.push(p1, p2, p3);

  const today = new Date();
  const grantDate = new Date(today.getFullYear(), today.getMonth() - 2, 5);

  // Empréstimo parcelado de João (3 parcelas)
  const loan1 = createLoanRecord({
    personId: p1.id,
    principal: 3000,
    grantDate: grantDate.toISOString().slice(0, 10),
    interestRate: 10,
    lateInterestRate: 5,
    isInstallment: true,
    installmentCount: 3,
  });

  // Empréstimo à vista de Maria
  const grantDate2 = new Date(today.getFullYear(), today.getMonth() - 1, 10);
  const loan2 = createLoanRecord({
    personId: p2.id,
    principal: 1500,
    grantDate: grantDate2.toISOString().slice(0, 10),
    interestRate: 15,
    lateInterestRate: 8,
    isInstallment: false,
    installmentCount: 1,
  });

  // Empréstimo parcelado de Carlos (4 parcelas) — algumas atrasadas
  const grantDate3 = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const loan3 = createLoanRecord({
    personId: p3.id,
    principal: 4000,
    grantDate: grantDate3.toISOString().slice(0, 10),
    interestRate: 12,
    lateInterestRate: 6,
    isInstallment: true,
    installmentCount: 4,
  });

  // Marca primeira parcela de João como paga
  const joaoInstallments = db.installments
    .filter((i) => i.loanId === loan1.id)
    .sort((a, b) => a.number - b.number);
  if (joaoInstallments[0]) {
    markPaidInternal(joaoInstallments[0], joaoInstallments[0].dueDate, 'Pagamento no vencimento');
  }

  return { people: db.people.length, loans: db.loans.length };
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function createLoanRecord({
  personId,
  principal,
  grantDate,
  interestRate,
  lateInterestRate,
  isInstallment,
  installmentCount,
}) {
  const count = isInstallment ? Math.max(1, Number(installmentCount) || 1) : 1;
  const baseAmount = Number(principal) / count;
  // Valor da parcela = principal/n + juros do empréstimo sobre a parcela
  const installmentAmount = round2(baseAmount * (1 + Number(interestRate) / 100));

  const loan = {
    id: uuidv4(),
    code: nextLoanCode(),
    personId,
    principal: Number(principal),
    grantDate,
    interestRate: Number(interestRate),
    lateInterestRate: Number(lateInterestRate),
    isInstallment: Boolean(isInstallment),
    installmentCount: count,
    installmentAmount,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  db.loans.push(loan);

  for (let n = 1; n <= count; n++) {
    db.installments.push({
      id: uuidv4(),
      loanId: loan.id,
      personId,
      number: n,
      dueDate: addMonths(grantDate, n),
      originalAmount: installmentAmount,
      lateInterestApplied: 0,
      daysLate: 0,
      amountDue: installmentAmount,
      status: 'pending',
      paidAt: null,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return loan;
}

function nextLoanCode() {
  const seq = String(db.loans.length + 1).padStart(4, '0');
  const day = todayStr().replace(/-/g, '');
  return `EMP-${day}-${seq}`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atualiza status de parcelas vencidas e aplica juros de atraso (uma vez por dia de atraso acumulado desde o vencimento).
 * Juros = amountDue * lateInterestRate% * dias de atraso (sobre o valor original + juros já aplicados recalculados de forma simples).
 * Estratégia: juros de atraso = originalAmount * (lateInterestRate/100) * diasAtraso
 */
function refreshLateInterest() {
  const today = todayStr();
  const loanMap = Object.fromEntries(db.loans.map((l) => [l.id, l]));

  for (const inst of db.installments) {
    if (inst.status === 'paid' || inst.status === 'cancelled') continue;

    const loan = loanMap[inst.loanId];
    if (!loan || loan.status === 'cancelled') continue;

    if (inst.dueDate < today) {
      const daysLate = daysBetween(inst.dueDate, today);
      const lateInterest = round2(
        inst.originalAmount * (loan.lateInterestRate / 100) * daysLate
      );
      inst.daysLate = daysLate;
      inst.lateInterestApplied = lateInterest;
      inst.amountDue = round2(inst.originalAmount + lateInterest);
      inst.status = 'overdue';
    } else {
      inst.daysLate = 0;
      inst.lateInterestApplied = 0;
      inst.amountDue = inst.originalAmount;
      inst.status = 'pending';
    }
  }
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T12:00:00');
  const b = new Date(toStr + 'T12:00:00');
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function markPaidInternal(inst, paidDate, note = '') {
  refreshLateInterest();
  const amount = inst.amountDue;
  inst.status = 'paid';
  inst.paidAt = paidDate || todayStr();
  inst.paidAmount = amount;
  inst.amountDue = 0;

  const tx = {
    id: uuidv4(),
    type: 'payment',
    installmentId: inst.id,
    loanId: inst.loanId,
    personId: inst.personId,
    amount,
    date: inst.paidAt,
    note: note || `Pagamento parcela #${inst.number}`,
    createdAt: new Date().toISOString(),
  };
  db.transactions.push(tx);

  checkLoanCompletion(inst.loanId);
  return tx;
}

function checkLoanCompletion(loanId) {
  const all = db.installments.filter((i) => i.loanId === loanId);
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan || loan.status === 'cancelled') return;

  const open = all.filter((i) => i.status === 'pending' || i.status === 'overdue');
  if (open.length === 0) {
    loan.status = 'completed';
  } else {
    loan.status = 'active';
  }
}

module.exports = {
  db,
  reset,
  seed,
  createLoanRecord,
  refreshLateInterest,
  markPaidInternal,
  checkLoanCompletion,
  round2,
  todayStr,
  daysBetween,
  addMonths,
};
