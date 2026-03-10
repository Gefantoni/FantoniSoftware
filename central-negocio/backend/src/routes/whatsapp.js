// Rotas de WhatsApp — disparos em massa e webhook SDR
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');
const whatsappService = require('../services/whatsapp');
const openai = require('openai');

const router = express.Router();
const openaiClient = new (require('openai'))({ apiKey: process.env.OPENAI_API_KEY });

// POST /whatsapp/disparar — disparo em massa (recebe JSON com lista de contatos)
router.post('/disparar', autenticar, adminOuComercial, async (req, res) => {
  const { contatos, mensagem } = req.body;
  if (!contatos || !mensagem) {
    return res.status(400).json({ erro: 'contatos e mensagem são obrigatórios' });
  }
  if (!Array.isArray(contatos) || contatos.length === 0) {
    return res.status(400).json({ erro: 'contatos deve ser um array não vazio' });
  }

  try {
    // Inicia o disparo de forma assíncrona e retorna imediatamente
    const resultados = await whatsappService.dispararEmMassa(contatos, mensagem);
    res.json({ mensagem: 'Disparo concluído', resultados });
  } catch (err) {
    console.error('Erro no disparo:', err);
    res.status(500).json({ erro: 'Erro ao realizar disparo' });
  }
});

// POST /whatsapp/webhook — recebe mensagens da EvolutionAPI
router.post('/webhook', async (req, res) => {
  try {
    const { data: evento } = req.body;
    if (!evento || evento.messageType !== 'conversation') {
      return res.json({ ignorado: true });
    }

    const numero = evento.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const mensagemRecebida = evento.message?.conversation;

    if (!numero || !mensagemRecebida) return res.json({ ignorado: true });

    // Verifica se é cliente existente
    const { data: clienteExistente } = await supabaseAdmin
      .from('perfis')
      .select('id, nome')
      .eq('whatsapp', numero)
      .single();

    if (clienteExistente) {
      // Cliente existente — encaminha para Chatwoot (lógica simplificada)
      console.log(`Mensagem de cliente ${clienteExistente.nome}: ${mensagemRecebida}`);
      return res.json({ tipo: 'cliente', encaminhado: true });
    }

    // Lead novo — ativa fluxo SDR
    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('whatsapp', numero)
      .single();

    if (!lead) {
      // Cadastra novo lead
      const { data: novoLead } = await supabaseAdmin
        .from('leads')
        .insert({ whatsapp: numero, status: 'novo', origem: 'whatsapp' })
        .select().single();
      lead = novoLead;
    }

    // Busca histórico de conversa do SDR
    const { data: historico } = await supabaseAdmin
      .from('sdr_conversas')
      .select('*')
      .eq('lead_id', lead.id)
      .order('criado_em')
      .limit(10);

    // Busca prompt do SDR nas configurações
    const { data: config } = await supabaseAdmin
      .from('base_conhecimento')
      .select('resposta')
      .eq('pergunta', '__SDR_PROMPT__')
      .single();

    const promptSDR = config?.resposta || `Você é um assistente comercial da empresa.
Seu objetivo é qualificar leads interessados no sistema PDV.
Seja simpático, profissional e responda em português.
Descubra: nome da empresa, segmento, número de funcionários e interesse no sistema.
Quando o lead demonstrar interesse real, diga que vai transferi-lo para um consultor.`;

    const mensagensHistorico = (historico || []).flatMap(h => [
      { role: 'user', content: h.mensagem_lead },
      { role: 'assistant', content: h.resposta_ia }
    ]);

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptSDR },
        ...mensagensHistorico,
        { role: 'user', content: mensagemRecebida }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const respostaIA = completion.choices[0].message.content;

    // Salva conversa
    await supabaseAdmin.from('sdr_conversas').insert({
      lead_id: lead.id,
      mensagem_lead: mensagemRecebida,
      resposta_ia: respostaIA
    });

    // Envia resposta via WhatsApp
    await whatsappService.enviarMensagem(numero, respostaIA);

    res.json({ tipo: 'lead', respondido: true });
  } catch (err) {
    console.error('Erro no webhook WhatsApp:', err);
    res.status(500).json({ erro: 'Erro no webhook' });
  }
});

module.exports = router;
