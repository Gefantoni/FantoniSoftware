// Servidor principal — Central do Negócio
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middlewares globais ----
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// ---- Rotas da API ----
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/videoaulas', require('./routes/videoaulas'));
app.use('/api/agente-ia', require('./routes/agente-ia'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/financeiro-cliente', require('./routes/financeiro-cliente'));
app.use('/api/financeiro-admin', require('./routes/financeiro-admin'));
app.use('/api/asaas', require('./routes/asaas'));
app.use('/api/comercial', require('./routes/comercial'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
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

app.listen(PORT, () => {
  console.log(`\n🚀 Central do Negócio rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Frontend: http://localhost:${PORT}\n`);
});

module.exports = app;
