// Rotas de integração com Asaas
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuFinanceiro } = require('../middleware/roles');
const asaasService = require('../services/asaas');

const router = express.Router();

// POST /asaas/cobranca — cria cobrança no Asaas e salva lançamento
router.post('/cobranca', autenticar, adminOuFinanceiro, async (req, res) => {
  const { cliente_id, valor, vencimento, descricao, tipo_cobranca, categoria } = req.body;
  if (!valor || !vencimento || !descricao) {
    return res.status(400).json({ erro: 'valor, vencimento e descricao são obrigatórios' });
  }

  try {
    // Busca dados do cliente
    const { data: perfil } = await supabaseAdmin
      .from('perfis').select('*').eq('id', cliente_id).single();

    // Busca ou cria cliente no Asaas
    const clienteAsaas = await asaasService.buscarOuCriarCliente({
      nome: perfil.nome,
      email: perfil.email,
      mobilePhone: perfil.whatsapp
    });

    // Cria cobrança
    const cobranca = await asaasService.criarCobranca({
      customer: clienteAsaas.id,
      billingType: tipo_cobranca || 'BOLETO',
      value: parseFloat(valor),
      dueDate: vencimento,
      description: descricao
    });

    // Salva lançamento no banco
    const { data: lancamento } = await supabaseAdmin
      .from('lancamentos')
      .insert({
        tipo: 'receita',
        categoria: categoria || 'mensalidade',
        descricao,
        valor: parseFloat(valor),
        cliente_id,
        asaas_cobranca_id: cobranca.id,
        status: 'pendente',
        vencimento
      })
      .select().single();

    res.status(201).json({ cobranca, lancamento });
  } catch (err) {
    console.error('Erro ao criar cobrança:', err.message);
    res.status(500).json({ erro: 'Erro ao criar cobrança' });
  }
});

// GET /asaas/cobrancas — lista cobranças do Asaas
router.get('/cobrancas', autenticar, adminOuFinanceiro, async (req, res) => {
  try {
    const { status, dateCreated } = req.query;
    const cobrancas = await asaasService.listarCobrancas({ status, dateCreated });
    res.json(cobrancas);
  } catch (err) {
    console.error('Erro ao listar cobranças:', err.message);
    res.status(500).json({ erro: 'Erro ao listar cobranças' });
  }
});

// POST /asaas/baixa/:id — dá baixa manual em uma cobrança
router.post('/baixa/:id', autenticar, adminOuFinanceiro, async (req, res) => {
  const { paymentDate, value } = req.body;
  try {
    const resultado = await asaasService.darBaixa(req.params.id, {
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      value
    });

    // Atualiza status no banco local
    await supabaseAdmin
      .from('lancamentos')
      .update({ status: 'pago', pago_em: paymentDate || new Date().toISOString().split('T')[0] })
      .eq('asaas_cobranca_id', req.params.id);

    res.json({ mensagem: 'Baixa realizada', resultado });
  } catch (err) {
    console.error('Erro ao dar baixa:', err.message);
    res.status(500).json({ erro: 'Erro ao processar baixa' });
  }
});

// Middleware de autenticação para o webhook do Asaas
// Configure ASAAS_WEBHOOK_TOKEN no .env com o token definido no painel Asaas
function verificarWebhookAsaas(req, res, next) {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!tokenEsperado) {
    if (process.env.NODE_ENV === 'production') {
      console.error('ASAAS_WEBHOOK_TOKEN não configurado — bloqueando webhook em produção');
      return res.status(401).json({ erro: 'Não autorizado' });
    }
    console.warn('AVISO: ASAAS_WEBHOOK_TOKEN não configurado — webhook aberto!');
    return next();
  }
  const tokenRecebido = req.headers['asaas-access-token'];
  if (tokenRecebido !== tokenEsperado) {
    console.warn(`Webhook Asaas bloqueado — token inválido (IP: ${req.ip})`);
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  next();
}

// POST /asaas/webhook — recebe notificações automáticas do Asaas
router.post('/webhook', verificarWebhookAsaas, async (req, res) => {
  try {
    const { event, payment } = req.body;
    if (!event || !payment?.id) return res.status(400).json({ erro: 'Payload inválido' });

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      // Atualiza lançamento como pago
      await supabaseAdmin
        .from('lancamentos')
        .update({
          status: 'pago',
          pago_em: payment.paymentDate || new Date().toISOString().split('T')[0]
        })
        .eq('asaas_cobranca_id', payment.id);
    }

    if (event === 'PAYMENT_OVERDUE') {
      await supabaseAdmin
        .from('lancamentos')
        .update({ status: 'pendente' })
        .eq('asaas_cobranca_id', payment.id);
    }

    res.json({ recebido: true });
  } catch (err) {
    console.error('Erro no webhook Asaas:', err.message);
    res.status(500).json({ erro: 'Erro ao processar notificação' });
  }
});

module.exports = router;
