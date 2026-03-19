// Serviço de fila de disparos (WhatsApp + Email)
const { enviarMensagem } = require('./whatsapp');
const { enviarEmail }    = require('./email');
const { supabaseAdmin }  = require('../supabase');
const OpenAI = require('openai');

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Filas em memória: campanhaId → { timer, pausado, indice, contatos, config }
const filas = new Map();

// ---------- Geração de mensagem IA ----------

async function gerarMensagemWA({ nomeFantasia, razaoSocial, municipio, estado, segmento }) {
  const nome = nomeFantasia || razaoSocial || 'amigo(a)';
  const local = municipio ? `${municipio}${estado ? '/' + estado : ''}` : '';
  const seg   = segmento  ? segmento.toLowerCase() : 'seu negócio';

  const prompt = `Você é um SDR (representante de vendas) da Fantoni Software.
Escreva uma mensagem de WhatsApp curta (máximo 3 linhas), natural e descontraída, para o primeiro contato com um estabelecimento.
NÃO use saudações genéricas como "Olá, tudo bem?". Chame pelo nome do estabelecimento.
NÃO mencione preço. NÃO use emojis em excesso (máximo 1).
O objetivo é despertar curiosidade sobre o sistema PDV para ${seg}${local ? ' em ' + local : ''}.
Assine como Douglas, da Fantoni Software.

Dados do lead:
- Nome do estabelecimento: ${nome}
- Segmento: ${seg}
- Cidade: ${local || 'não informada'}

Retorne APENAS o texto da mensagem, sem aspas, sem formatação extra.`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.8,
  });
  return completion.choices[0].message.content.trim();
}

async function gerarMensagemEmail({ nomeFantasia, razaoSocial, municipio, estado, segmento }) {
  const nome = nomeFantasia || razaoSocial || 'Estabelecimento';
  const local = municipio ? `${municipio}${estado ? '/' + estado : ''}` : '';
  const seg   = segmento  ? segmento.toLowerCase() : 'seu negócio';

  const prompt = `Você é um SDR da Fantoni Software.
Escreva 2-3 frases para o corpo de um email de prospecção para um estabelecimento do segmento: ${seg}${local ? ' em ' + local : ''}.
Mencione o nome "${nome}". Seja profissional mas próximo. Foque no problema de controle de vendas e estoque.
NÃO mencione preço. Retorne APENAS o texto corrido, sem saudação (a saudação já está no template).`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.7,
  });
  return completion.choices[0].message.content.trim();
}

// ---------- Normaliza telefone para formato internacional ----------
function normalizarTelefone(tel) {
  if (!tel) return null;
  // Pega primeiro número se vier separado por vírgula/ponto-vírgula
  const primeiro = String(tel).split(/[,;]/)[0].trim();
  const numeros = primeiro.replace(/\D/g, '');
  if (numeros.length < 8) return null;
  // Adiciona 55 se não tiver código de país
  if (numeros.startsWith('55') && numeros.length >= 12) return numeros;
  if (numeros.length >= 10) return '55' + numeros;
  return null;
}

// ---------- Persiste status no Supabase ----------
async function atualizarStatusLead(campanhaId, leadId, status, erro = null) {
  try {
    await supabaseAdmin
      .from('disparos_leads')
      .upsert({ campanha_id: campanhaId, lead_id: leadId, status, erro, atualizado_em: new Date().toISOString() });
  } catch (e) {
    console.error('[Disparos] Erro ao atualizar status lead:', e.message);
  }
}

async function atualizarCampanha(campanhaId, campos) {
  try {
    await supabaseAdmin
      .from('disparos_campanhas')
      .update({ ...campos, atualizado_em: new Date().toISOString() })
      .eq('id', campanhaId);
  } catch (e) {
    console.error('[Disparos] Erro ao atualizar campanha:', e.message);
  }
}

// ---------- Verifica janela de horário ----------
function dentroDoHorario(horaInicio, horaFim) {
  if (!horaInicio || !horaFim) return true;
  const agora = new Date();
  const [hi, mi] = horaInicio.split(':').map(Number);
  const [hf, mf] = horaFim.split(':').map(Number);
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const minInicio = hi * 60 + mi;
  const minFim    = hf * 60 + mf;
  return minAgora >= minInicio && minAgora <= minFim;
}

// ---------- Processa um contato ----------
async function processarContato(campanhaId, contato, config, instancias) {
  const { canal, horaInicio, horaFim } = config;
  const enviarWA    = canal === 'whatsapp' || canal === 'ambos';
  const enviarMail  = canal === 'email'    || canal === 'ambos';

  const segmento = contato.atividades_principal || '';
  const params   = {
    nomeFantasia: contato.nome_fantasia,
    razaoSocial:  contato.razao_social,
    municipio:    contato.municipio,
    estado:       contato.estado,
    segmento,
  };

  let erros = [];

  // WhatsApp
  if (enviarWA) {
    const tel = normalizarTelefone(contato.telefones);
    if (tel && instancias.length > 0) {
      // Round-robin entre instâncias
      const fila = filas.get(campanhaId);
      const idx  = (fila?.instanciaIdx || 0) % instancias.length;
      if (fila) fila.instanciaIdx = idx + 1;
      const inst = instancias[idx];

      try {
        const msgWA = await gerarMensagemWA(params);
        await enviarMensagem(tel, msgWA, inst.nome_instancia, inst.api_key, inst.base_url);
        await atualizarStatusLead(campanhaId, contato._id, 'enviado_wa');
      } catch (e) {
        erros.push('WA: ' + e.message);
        await atualizarStatusLead(campanhaId, contato._id, 'erro_wa', e.message);
      }
    }
  }

  // Email
  if (enviarMail && contato.email) {
    try {
      const msgEmail = await gerarMensagemEmail(params);
      await enviarEmail({ para: contato.email, ...params, mensagemIA: msgEmail });
      await atualizarStatusLead(campanhaId, contato._id, erros.length ? 'parcial' : 'enviado_email');
    } catch (e) {
      erros.push('Email: ' + e.message);
      await atualizarStatusLead(campanhaId, contato._id, 'erro_email', e.message);
    }
  }
}

// ---------- Inicia fila de disparo ----------
async function iniciarFila(campanhaId, contatos, config, instancias) {
  if (filas.has(campanhaId)) pararFila(campanhaId);

  const estado = {
    indice:       0,
    pausado:      false,
    instanciaIdx: 0,
    contatos,
    config,
    instancias,
  };
  filas.set(campanhaId, estado);

  await atualizarCampanha(campanhaId, { status: 'ativo', total: contatos.length, enviados: 0, erros: 0 });

  const intervaloMs = (config.intervaloSegundos || 60) * 1000;

  async function proximoEnvio() {
    const fila = filas.get(campanhaId);
    if (!fila || fila.pausado) return;
    if (fila.indice >= fila.contatos.length) {
      await atualizarCampanha(campanhaId, { status: 'concluido' });
      filas.delete(campanhaId);
      return;
    }

    if (!dentroDoHorario(config.horaInicio, config.horaFim)) {
      // Fora do horário — aguarda 1 minuto e tenta novamente
      setTimeout(proximoEnvio, 60_000);
      return;
    }

    const contato = fila.contatos[fila.indice];
    fila.indice++;

    try {
      await processarContato(campanhaId, contato, config, instancias);
      await supabaseAdmin.rpc('disparos_incrementar_enviados', { p_id: campanhaId }).catch(() => {});
    } catch (e) {
      console.error('[Disparos] Erro no contato:', e.message);
    }

    if (fila.indice < fila.contatos.length) {
      fila.timer = setTimeout(proximoEnvio, intervaloMs);
    } else {
      await atualizarCampanha(campanhaId, { status: 'concluido' });
      filas.delete(campanhaId);
    }
  }

  // Inicia imediatamente o primeiro envio
  proximoEnvio();
}

function pausarFila(campanhaId) {
  const fila = filas.get(campanhaId);
  if (!fila) return false;
  fila.pausado = true;
  if (fila.timer) clearTimeout(fila.timer);
  return true;
}

function retomarFila(campanhaId) {
  const fila = filas.get(campanhaId);
  if (!fila) return false;
  fila.pausado = false;
  // Reinicia o loop
  iniciarFila(campanhaId, fila.contatos.slice(fila.indice), fila.config, fila.instancias);
  return true;
}

function pararFila(campanhaId) {
  const fila = filas.get(campanhaId);
  if (fila?.timer) clearTimeout(fila.timer);
  filas.delete(campanhaId);
}

function statusFila(campanhaId) {
  const fila = filas.get(campanhaId);
  if (!fila) return null;
  return {
    total:   fila.contatos.length,
    indice:  fila.indice,
    pausado: fila.pausado,
  };
}

module.exports = {
  iniciarFila,
  pausarFila,
  retomarFila,
  pararFila,
  statusFila,
  gerarMensagemWA,
  gerarMensagemEmail,
  normalizarTelefone,
};
