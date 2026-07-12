# G&F Financeiro — Gestão de Empréstimos

Sistema web para gerenciamento de empréstimos informais: cadastro de pessoas, concessão de crédito, parcelas mensais automáticas, juros por atraso, baixas/adiantamentos e relatórios de recebimentos.

## Stack

| Camada    | Tecnologia                          |
|-----------|-------------------------------------|
| Backend   | Node.js + Express                   |
| Banco     | Em memória (reinicia com o servidor)|
| Frontend  | React 18 + Vite + React Router      |

## Como rodar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- npm (vem com o Node)

### 1. Instalar dependências

Na pasta raiz do projeto:

```bash
npm run install:all
```

Ou separadamente:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Subir o backend (API)

Em um terminal:

```bash
cd backend
npm run dev
```

A API fica em **http://localhost:3001**  
Health check: http://localhost:3001/api/health

Ao iniciar, o servidor carrega **dados de exemplo** (3 pessoas e empréstimos) para você testar na hora.

### 3. Subir o frontend

Em outro terminal:

```bash
cd frontend
npm run dev
```

Abra **http://localhost:5173** no navegador.

O Vite faz proxy de `/api` para o backend na porta 3001.

## Login

| Campo | Valor |
|-------|-------|
| E-mail | `admin@admin.com` |
| Senha | `123456` |

Sem login, as rotas da API e do sistema ficam bloqueadas. A sessão dura 24h (token no navegador).

## Funcionalidades

### Pessoas
- Cadastro com nome, contato, documento, endereço e observações
- Lista com totais pendentes/atrasados
- Filtro “só com débito”
- Histórico por pessoa

### Empréstimos
- Valor principal, data de concessão, taxa de juros
- Parcelado (N parcelas) ou à vista
- Taxa de juros por atraso (% ao dia sobre o valor original da parcela)
- Parcelas geradas automaticamente com vencimentos mensais

### Parcelas
- Status: **pendente**, **atrasada**, **paga**
- **Dar baixa** — registra pagamento (com juros de atraso se vencida)
- **Adiantar** — paga antes do vencimento sem juros de atraso
- **Recalcular juros** — atualiza atrasos e juros

### Dashboard e relatórios
- Recebido no mês/ano
- Parcelas não pagas do mês
- Resumo de atrasos e pendências
- Pessoas com débito
- Fluxo de caixa por período
- Histórico completo de transações

## Regras de cálculo

1. **Valor da parcela**  
   `(principal ÷ N) × (1 + taxa_juros / 100)`

2. **Vencimentos**  
   Mensais a partir da data de concessão (parcela 1 = +1 mês, parcela 2 = +2 meses, …)

3. **Juros de atraso**  
   `valor_original × (taxa_atraso / 100) × dias_em_atraso`  
   Recalculados automaticamente ao listar dados ou ao pagar.

## API (principais endpoints)

Rotas protegidas exigem header: `Authorization: Bearer <token>`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login (`{ email, password }`) — público |
| GET | `/api/auth/me` | Usuário da sessão |
| POST | `/api/auth/logout` | Encerrar sessão |
| GET | `/api/people` | Listar pessoas |
| POST | `/api/people` | Criar pessoa |
| GET | `/api/loans` | Listar empréstimos |
| POST | `/api/loans` | Criar empréstimo (+ parcelas) |
| GET | `/api/installments` | Listar parcelas (filtros: status, month, year, personId) |
| POST | `/api/installments/:id/pay` | Dar baixa / adiantar (`{ "advance": true }`) |
| GET | `/api/dashboard` | Dashboard (`?year=&month=`) |
| GET | `/api/reports/cashflow` | Fluxo de caixa (`?from=&to=`) |
| GET | `/api/transactions` | Histórico |
| POST | `/api/seed` | Recarregar dados de exemplo |

## Estrutura do projeto

```
FINANCEIRO_GABRIEL/
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js      # Entrada Express
│       ├── routes.js      # Rotas REST
│       ├── auth.js        # Login e sessões
│       ├── services.js    # Regras de negócio
│       └── db.js          # Banco em memória + seed
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── auth.jsx       # Contexto de autenticação
│       ├── api.js
│       ├── styles.css
│       └── pages/         # Telas do sistema (inclui Login)
├── package.json           # Scripts da raiz
└── README.md
```

## Observações

- O banco **em memória** perde os dados ao reiniciar o backend. Use `POST /api/seed` ou reinicie o servidor para voltar aos dados de exemplo.
- Para produção, troque o store em memória por PostgreSQL/SQLite e adicione autenticação.
