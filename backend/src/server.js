const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { seed } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'g-f-financeiro', storage: 'memory' });
});

// Rotas da API (login público; demais protegidas por token)
app.use('/api', routes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

seed();

// Exporta o app para a Vercel (serverless / services)
module.exports = app;

// Em local (ou host com processo Node contínuo), sobe o servidor HTTP
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
  });
}
