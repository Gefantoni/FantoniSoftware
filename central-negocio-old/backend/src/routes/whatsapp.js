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

// ─── Utilitários ──────────────────────────────────────────────────────────────

function log(tag, ...args) {
  const linha = `[${new Date().toISOString()}] [${tag}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  process.stdout.write(linha);
  try { fs.appendFileSync(LOG_FILE, linha); } catch {}
}

function verificarWebhookSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      log('WEBHOOK_AUTH', `BLOQUEADO — WEBHOOK_SECRET não configurado (IP: ${req.ip})`);
      return res.status(401).json({ erro: 'Não autorizado' });
    }
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

// ─── Disparo em massa ─────────────────────────────────────────────────────────

router.post('/disparar', autenticar, adminOuComercial, async (req, res) => {
  const { contatos, mensagem, instancia_id } = req.body;
  if (!contatos || !mensagem)
    return res.status(400).json({ erro: 'contatos e mensagem são obrigatórios' });
  if (!Array.isArray(contatos) || contatos.length === 0)
    return res.status(400).json({ erro: 'contatos deve ser um array não vazio' });

  // Busca parâmetros da instância se informada
  let instNome, apiKey, baseUrl;
  if (instancia_id) {
    const { data: inst } = await supabaseAdmin
      .from('instancias_whatsapp').select('*').eq('id', instancia_id).single();
    if (inst) {
      instNome = inst.instancia_evo;
      apiKey   = inst.apikey   || process.env.EVOLUTION_API_KEY;
      baseUrl  = inst.api_url  || process.env.EVOLUTION_API_URL;
    }
  }

  try {
    const resultados = await whatsappService.dispararEmMassa(contatos, mensagem, instNome, apiKey, baseUrl);
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

// ─── Webhook Chatwoot — reply humano → pausa IA ───────────────────────────────

router.post('/chatwoot-webhook', verificarWebhookSecret, (req, res) => {
  res.status(200).json({ recebido: true });
  processarWebhookChatwoot(req.body).catch(err => log('CHATWOOT_WEBHOOK_ERRO', err.message));
});

// ─── Reativar IA para um lead ────────────────────────────────────────────────

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

  // Ignora mensagens do próprio bot (evita loop)
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
  const numero      = remoteJid.replace('@s.whatsapp.net', '');
  if (!numero) { log('WEBHOOK_IGNORADO', 'numero vazio'); return; }

  // ── Extrai conteúdo conforme tipo da mensagem ──
  let mensagemRecebida;

  if (messageType === 'conversation') {
    mensagemRecebida = evento.message?.conversation;

  } else if (messageType === 'extendedTextMessage') {
    mensagemRecebida = evento.message?.extendedTextMessage?.text;

  } else if (messageType === 'audioMessage' || messageType === 'pttMessage') {
    log('WEBHOOK_AUDIO', `recebido de ${numero} — transcrevendo...`);
    mensagemRecebida = await agenteService.transcreverAudio({
      url:    evento.message?.audioMessage?.url    || evento.message?.pttMessage?.url,
      base64: evento.message?.audioMessage?.base64 || evento.message?.pttMessage?.base64
    });
    log('WEBHOOK_AUDIO', `transcrição: "${mensagemRecebida?.substring(0, 80)}"`);

  } else if (messageType === 'imageMessage') {
    log('WEBHOOK_IMAGEM', `recebido de ${numero} — analisando...`);
    const caption   = evento.message?.imageMessage?.caption || '';
    const descricao = await agenteService.analisarImagem({
      url:    evento.message?.imageMessage?.url,
      base64: evento.message?.imageMessage?.base64
    });
    mensagemRecebida = caption
      ? `${caption}\n[Imagem enviada: ${descricao}]`
      : `[Imagem enviada: ${descricao}]`;
    log('WEBHOOK_IMAGEM', `análise: "${mensagemRecebida?.substring(0, 80)}"`);

  } else {
    log('WEBHOOK_IGNORADO', `tipo não suportado: ${messageType}`);
    return;
  }

  if (!mensagemRecebida?.trim()) { log('WEBHOOK_IGNORADO', 'mensagem vazia após extração'); return; }

  log('WEBHOOK_MENSAGEM', `de=${numero} tipo=${messageType} texto="${mensagemRecebida.substring(0, 80)}"`);

  // 1. Busca instância e agente vinculado
  const { data: instanciaDB, error: instError } = await supabaseAdmin
    .from('instancias_whatsapp')
    .select('*, agentes_ia_comercial(*)')
    .eq('instancia_evo', instanciaNome)
    .single();

  if (instError || !instanciaDB) {
    log('WEBHOOK_ERRO', `Instância não encontrada: "${instanciaNome}" — verifique o campo instancia_evo`);
    return;
  }
  if (!instanciaDB.agentes_ia_comercial) {
    log('WEBHOOK_IGNORADO', `Instância "${instanciaNome}" sem agente IA vinculado`);
    return;
  }

  const agente = instanciaDB.agentes_ia_comercial;
  log('WEBHOOK_AGENTE', `usando: ${agente.nome} (id=${agente.id}, provider=${agente.provider || 'openai'})`);

  // 2. Busca ou cria lead (upsert garante idempotência em webhooks duplicados)
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .upsert(
      { whatsapp: numero, status: 'novo', origem: 'whatsapp', instancia: instanciaNome },
      { onConflict: 'whatsapp', ignoreDuplicates: false }
    )
    .select().single();

  if (leadErr) { log('WEBHOOK_ERRO', 'falha ao criar/buscar lead:', leadErr.message); return; }

  // 3. Se IA pausada, apenas registra a interação e para
  if (lead.ia_ativa === false) {
    log('WEBHOOK_IA', `Lead ${lead.id} com IA pausada — aguardando humano responder via Chatwoot`);
    await supabaseAdmin.from('leads')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('id', lead.id);
    return;
  }

  // 4. Busca histórico das últimas 8 trocas
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

  // 5. Busca oportunidades abertas (contexto para Function Calling)
  const { data: oportunidades } = await supabaseAdmin
    .from('oportunidades')
    .select('id, titulo, etapa')
    .eq('lead_id', lead.id)
    .not('etapa', 'in', '("fechado","perdido")');

  // 6. Chama agente IA
  log('WEBHOOK_IA', `chamando IA para lead ${lead.id}...`);
  let respostaIA;
  try {
    respostaIA = await agenteService.responderComAgente(
      agente,
      mensagemRecebida,
      mensagensHistorico,
      { lead_id: lead.id, oportunidades: oportunidades || [] }
    );
    log('WEBHOOK_IA', `resposta: "${respostaIA.substring(0, 100)}"`);
  } catch (err) {
    log('WEBHOOK_ERRO', 'falha na IA:', err.message);
    return;
  }

  // 7. Persiste conversa e atualiza lead
  await Promise.all([
    supabaseAdmin.from('sdr_conversas').insert({
      lead_id:       lead.id,
      mensagem_lead: mensagemRecebida,
      resposta_ia:   respostaIA
    }),
    supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'conversa_ia', lead_id: lead.id,
      descricao: `Lead: ${mensagemRecebida.substring(0, 200)} | IA: ${respostaIA.substring(0, 200)}`
    }).catch(() => {}),
    supabaseAdmin.from('leads')
      .update({ ultima_interacao: new Date().toISOString() })
      .eq('id', lead.id)
  ]);

  // 8. Envia resposta via EvoAPI com 1 retry em caso de falha
  const evoUrl  = instanciaDB.api_url       || process.env.EVOLUTION_API_URL;
  const evoKey  = instanciaDB.apikey        || process.env.EVOLUTION_API_KEY;
  const evoInst = instanciaDB.instancia_evo || instanciaNome;

  let enviado = false;
  for (let tentativa = 1; tentativa <= 2 && !enviado; tentativa++) {
    try {
      await whatsappService.enviarMensagem(numero, respostaIA, evoInst, evoKey, evoUrl);
      log('WEBHOOK_ENVIO', `✓ enviado para ${numero} (tentativa ${tentativa})`);
      enviado = true;
    } catch (err) {
      log('WEBHOOK_ERRO', `falha ao enviar (tentativa ${tentativa}): ${err.message}`);
      if (tentativa < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ─── Processamento Chatwoot — reply humano → pausa IA ─────────────────────────

async function processarWebhookChatwoot(payload) {
  log('CHATWOOT_WEBHOOK', `event=${payload.event} type=${payload.message_type} sender=${payload.sender?.type}`);

  if (payload.event !== 'message_created') return;

  // Só mensagens enviadas (outgoing)
  if (payload.message_type !== 'outgoing') return;

  // Filtra apenas agentes humanos reais.
  // agent_bot = mensagens da própria integração EvoAPI — NÃO pausam a IA
  if (payload.sender?.type !== 'agent') {
    log('CHATWOOT_WEBHOOK', `ignorando — sender.type="${payload.sender?.type}" (não é humano)`);
    return;
  }

  const conversaId = payload.conversation?.id;
  const conteudo   = payload.content;
  if (!conversaId || !conteudo) return;

  // Obtém número do lead via Chatwoot API
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

  if (!lead) { log('CHATWOOT_WEBHOOK', `lead não encontrado para número: ${numero}`); return; }

  // Pausa IA para este lead
  if (lead.ia_ativa !== false) {
    await supabaseAdmin.from('leads').update({ ia_ativa: false }).eq('id', lead.id);
    log('CHATWOOT_WEBHOOK', `IA pausada para lead ${lead.id} — humano assumiu`);
  }

  await supabaseAdmin.from('atividades_comercial').insert({
    tipo: 'resposta_humana', lead_id: lead.id,
    descricao: `Humano respondeu via Chatwoot: ${conteudo.substring(0, 200)}`
  }).catch(() => {});
}

module.exports = router;
