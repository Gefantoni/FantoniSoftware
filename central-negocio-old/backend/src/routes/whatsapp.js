// Rotas de WhatsApp — disparos em massa, webhook SDR e integração Chatwoot
const express        = require('express');
const fs             = require('fs');
const path           = require('path');
const { supabaseAdmin }    = require('../supabase');
const { autenticar }       = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');
const whatsappService      = require('../services/whatsapp');
const agenteService        = require('../services/agente-ia-comercial');
const chatwootService      = require('../services/chatwoot');

const router = express.Router();

const LOG_FILE = path.join(__dirname, '../../../webhook.log');

// Middleware de autenticação para webhooks via secret no header
function verificarWebhookSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // Em produção, bloqueia se o secret não estiver configurado
    if (process.env.NODE_ENV === 'production') {
      log('WEBHOOK_AUTH', `BLOQUEADO — WEBHOOK_SECRET não configurado (IP: ${req.ip})`);
      return res.status(401).json({ erro: 'Não autorizado' });
    }
    // Em desenvolvimento, avisa mas deixa passar
    log('WEBHOOK_AUTH', 'AVISO: WEBHOOK_SECRET não configurado — endpoint aberto!');
    return next();
  }
  const headerSecret = req.headers['x-webhook-secret'];
  if (headerSecret !== secret) {
    log('WEBHOOK_AUTH', `Acesso negado — secret inválido (IP: ${req.ip})`);
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  next();
}

function log(tag, ...args) {
  const linha = `[${new Date().toISOString()}] [${tag}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  process.stdout.write(linha);
  try { fs.appendFileSync(LOG_FILE, linha); } catch {}
}


// ─── Disparo em massa ─────────────────────────────────────────────────────────

router.post('/disparar', autenticar, adminOuComercial, async (req, res) => {
  const { contatos, mensagem } = req.body;
  if (!contatos || !mensagem)
    return res.status(400).json({ erro: 'contatos e mensagem são obrigatórios' });
  if (!Array.isArray(contatos) || contatos.length === 0)
    return res.status(400).json({ erro: 'contatos deve ser um array não vazio' });

  try {
    const resultados = await whatsappService.dispararEmMassa(contatos, mensagem);
    res.json({ mensagem: 'Disparo concluído', resultados });
  } catch (err) {
    console.error('Erro no disparo:', err);
    res.status(500).json({ erro: 'Erro ao realizar disparo' });
  }
});

// ─── Webhook EvoAPI v2 — rota com evento na URL (webhookByEvents: true) ───────

router.post('/webhook/messages-upsert', verificarWebhookSecret, (req, res) => {
  res.status(200).json({ recebido: true });
  const body = req.body;
  if (body && !body.event) body.event = 'messages.upsert';
  processarWebhookEvo(body).catch(err => log('WEBHOOK_ERRO_GERAL', err.message));
});

// ─── Webhook EvoAPI v2 — rota genérica ───────────────────────────────────────

router.post('/webhook', verificarWebhookSecret, (req, res) => {
  res.status(200).json({ recebido: true });
  processarWebhookEvo(req.body).catch(err => log('WEBHOOK_ERRO_GERAL', err.message));
});

// ─── Webhook Chatwoot — reply humano → WhatsApp ───────────────────────────────
// Configure no Chatwoot: Settings → Integrations → Webhooks → adicionar esta URL:
//   https://SEU_DOMINIO/api/whatsapp/chatwoot-webhook

router.post('/chatwoot-webhook', verificarWebhookSecret, (req, res) => {
  res.status(200).json({ recebido: true });
  processarWebhookChatwoot(req.body).catch(err => log('CHATWOOT_WEBHOOK_ERRO', err.message));
});

// ─── Reativar IA para um lead (painel admin) ──────────────────────────────────

router.post('/leads/:lead_id/reativar-ia', autenticar, adminOuComercial, async (req, res) => {
  try {
    await supabaseAdmin.from('leads').update({ ia_ativa: true }).eq('id', req.params.lead_id);
    res.json({ mensagem: 'IA reativada para este lead' });
  } catch {
    res.status(500).json({ erro: 'Erro ao reativar IA' });
  }
});

// ─── Processamento EvoAPI ─────────────────────────────────────────────────────

async function processarWebhookEvo(payload) {
  const { event, instance: instanciaNome, data: evento } = payload;

  log('WEBHOOK_RECEBIDO', `event=${event} instance=${instanciaNome}`);

  if (event !== 'messages.upsert') {
    log('WEBHOOK_IGNORADO', `evento não é messages.upsert: ${event}`);
    return;
  }
  if (!evento) { log('WEBHOOK_IGNORADO', 'data vazio'); return; }

  // Ignora mensagens enviadas pelo próprio bot (evita loop EvoAPI)
  if (evento.key?.fromMe === true) {
    log('WEBHOOK_IGNORADO', 'fromMe=true');
    return;
  }

  // Ignora grupos
  const remoteJid = evento.key?.remoteJid || '';
  if (remoteJid.endsWith('@g.us')) {
    log('WEBHOOK_IGNORADO', `grupo: ${remoteJid}`);
    return;
  }

  const messageType = evento.messageType;
  if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
    log('WEBHOOK_IGNORADO', `tipo não suportado: ${messageType}`);
    return;
  }

  const numero           = remoteJid.replace('@s.whatsapp.net', '');
  const mensagemRecebida = evento.message?.conversation || evento.message?.extendedTextMessage?.text;
  if (!numero || !mensagemRecebida) { log('WEBHOOK_IGNORADO', 'numero ou mensagem vazio'); return; }

  log('WEBHOOK_MENSAGEM', `de=${numero} texto="${mensagemRecebida.substring(0, 80)}"`);

  // 1. Busca instância e agente vinculado
  const { data: instanciaDB, error: instError } = await supabaseAdmin
    .from('instancias_whatsapp')
    .select('*, agentes_ia_comercial(*)')
    .eq('instancia_evo', instanciaNome)
    .single();

  if (instError || !instanciaDB) {
    log('WEBHOOK_ERRO', `Instância não encontrada: ${instanciaNome}`);
    return;
  }
  if (!instanciaDB.agentes_ia_comercial) {
    log('WEBHOOK_IGNORADO', `Instância ${instanciaNome} sem agente IA`);
    return;
  }

  const agente = instanciaDB.agentes_ia_comercial;
  log('WEBHOOK_AGENTE', `usando: ${agente.nome} (id=${agente.id})`);

  // 2. Busca ou cria lead (upsert evita duplicação em webhooks simultâneos)
  log('WEBHOOK_LEAD', `upsert lead para ${numero}`);
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .upsert(
      { whatsapp: numero, status: 'novo', origem: 'whatsapp', instancia: instanciaNome },
      { onConflict: 'whatsapp', ignoreDuplicates: false }
    )
    .select().single();
  if (leadErr) { log('WEBHOOK_ERRO', 'falha ao criar/buscar lead:', leadErr.message); return; }

  // 3. Se IA pausada, aguarda humano responder via Chatwoot
  if (lead.ia_ativa === false) {
    log('WEBHOOK_IA', `Lead ${lead.id} com IA pausada — aguardando humano`);
    await supabaseAdmin.from('leads').update({ ultima_interacao: new Date().toISOString() }).eq('id', lead.id);
    return;
  }

  // 5. Busca histórico (últimas 8 trocas, ordem garantida pelo id serial)
  const { data: historico } = await supabaseAdmin
    .from('sdr_conversas')
    .select('mensagem_lead, resposta_ia')
    .eq('lead_id', lead.id)
    .order('id', { ascending: false })
    .limit(8);

  const mensagensHistorico = (historico || []).reverse().flatMap(h => [
    { role: 'user',      content: h.mensagem_lead },
    { role: 'assistant', content: h.resposta_ia }
  ]);

  // 6. Busca oportunidades abertas (contexto para Function Calling da IA)
  const { data: oportunidades } = await supabaseAdmin
    .from('oportunidades')
    .select('id, titulo, etapa')
    .eq('lead_id', lead.id)
    .not('etapa', 'in', '("fechado","perdido")');

  // 7. Chama agente IA
  log('WEBHOOK_IA', `chamando IA (provider=${agente.provider || 'openai'})...`);
  let respostaIA;
  try {
    respostaIA = await agenteService.responderComAgente(
      agente,
      mensagemRecebida,
      mensagensHistorico,
      { lead_id: lead.id, oportunidades: oportunidades || [] }
    );
    log('WEBHOOK_IA', `resposta: "${respostaIA.substring(0, 80)}"`);
  } catch (err) {
    log('WEBHOOK_ERRO', 'falha na IA:', err.message);
    return;
  }

  // 8. Persiste conversa
  await supabaseAdmin.from('sdr_conversas').insert({
    lead_id:       lead.id,
    mensagem_lead: mensagemRecebida,
    resposta_ia:   respostaIA
  });
  await supabaseAdmin.from('atividades_comercial').insert({
    tipo: 'conversa_ia', lead_id: lead.id,
    descricao: `Lead: ${mensagemRecebida.substring(0, 200)} | IA: ${respostaIA.substring(0, 200)}`
  });
  await supabaseAdmin.from('leads')
    .update({ ultima_interacao: new Date().toISOString() })
    .eq('id', lead.id);

  // 9. Envia resposta ao WhatsApp via EvoAPI
  // (A EvoAPI nativa sincroniza automaticamente ao Chatwoot)
  const evoUrl  = instanciaDB.api_url       || process.env.EVOLUTION_API_URL;
  const evoKey  = instanciaDB.apikey        || process.env.EVOLUTION_API_KEY;
  const evoInst = instanciaDB.instancia_evo || instanciaNome;

  log('WEBHOOK_ENVIO', `enviando para ${numero} via ${evoInst}`);
  try {
    await whatsappService.enviarMensagem(numero, respostaIA, evoInst, evoKey, evoUrl);
    log('WEBHOOK_ENVIO', 'enviado com sucesso');
  } catch (err) {
    log('WEBHOOK_ERRO', 'falha ao enviar:', err.message);
  }
}

// ─── Processamento Chatwoot (reply humano → WhatsApp) ─────────────────────────

async function processarWebhookChatwoot(payload) {
  log('CHATWOOT_WEBHOOK', `event=${payload.event} type=${payload.message_type} sender=${payload.sender?.type}`);

  if (payload.event !== 'message_created') return;

  // Só mensagens enviadas (outgoing)
  if (payload.message_type !== 'outgoing') return;

  // Filtra apenas respostas de agentes humanos reais.
  // A EvoAPI cria mensagens como 'agent_bot' — essas já foram enviadas ao WhatsApp
  // pela integração nativa e NÃO devem pausar a IA.
  if (payload.sender?.type !== 'agent') {
    log('CHATWOOT_WEBHOOK', `ignorando — sender.type=${payload.sender?.type} (não é humano)`);
    return;
  }

  const conversaId = payload.conversation?.id;
  const conteudo   = payload.content;
  if (!conversaId || !conteudo) return;

  // Obtém o número do lead via Chatwoot API
  let numero;
  try {
    numero = await chatwootService.obterNumeroDeConversa(conversaId);
  } catch (err) {
    log('CHATWOOT_WEBHOOK_ERRO', 'não conseguiu obter número:', err.message);
    return;
  }

  log('CHATWOOT_WEBHOOK', `humano respondeu → ${numero}: "${conteudo.substring(0, 80)}"`);

  // Busca lead pelo número
  const { data: lead } = await supabaseAdmin
    .from('leads').select('id, ia_ativa').eq('whatsapp', numero).single();

  if (!lead) { log('CHATWOOT_WEBHOOK', `lead não encontrado: ${numero}`); return; }

  // Pausa IA para este lead (humano assumiu)
  if (lead.ia_ativa !== false) {
    await supabaseAdmin.from('leads').update({ ia_ativa: false }).eq('id', lead.id);
    log('CHATWOOT_WEBHOOK', `IA pausada para lead ${lead.id}`);
  }

  // Registra atividade
  await supabaseAdmin.from('atividades_comercial').insert({
    tipo: 'resposta_humana', lead_id: lead.id,
    descricao: `Humano respondeu via Chatwoot: ${conteudo.substring(0, 200)}`
  }).catch(() => {});
  // Nota: o reenvio ao WhatsApp é feito automaticamente pela integração
  // nativa EvoAPI ↔ Chatwoot — não precisamos fazer aqui.
}

module.exports = router;
