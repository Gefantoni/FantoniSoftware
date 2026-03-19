// Servidor principal — Central do Negócio
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Rate limiting ----
// Limite global: 200 req/15min por IP
const limiteGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições, tente novamente em alguns minutos.' }
});

// Limite restrito para autenticação: 10 tentativas/15min por IP
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

// ---- Middlewares globais ----
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', limiteGlobal);

// Serve arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// ---- Rotas da API ----
app.use('/api/auth/login', limiteAuth);
app.use('/api/auth/refresh', limiteAuth);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/videoaulas', require('./routes/videoaulas'));
app.use('/api/agente-ia', require('./routes/agente-ia'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/financeiro-cliente', require('./routes/financeiro-cliente'));
app.use('/api/financeiro-admin', require('./routes/financeiro-admin'));
app.use('/api/asaas', require('./routes/asaas'));
app.use('/api/comercial', require('./routes/comercial'));
app.use('/api/campanhas', require('./routes/campanhas'));
app.use('/api/oportunidades', require('./routes/oportunidades'));
app.use('/api/reunioes', require('./routes/reunioes'));
app.use('/api/agentes', require('./routes/agentes'));
app.use('/api/relatorios-comercial', require('./routes/relatorios-comercial'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/disparos', require('./routes/disparos'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/cardapio-ia', require('./routes/cardapio-ia'));

// ---- Rota de saúde ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ambiente: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ---- Fallback para SPA (páginas HTML do frontend) ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// ---- Tratamento de erros global ----
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// Em ambiente Vercel (serverless) não chamamos listen
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Central do Negócio rodando na porta ${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log(`   Frontend: http://localhost:${PORT}\n`);
  });
}

module.exports = app;
