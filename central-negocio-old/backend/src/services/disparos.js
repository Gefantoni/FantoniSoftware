// Serviço de fila de disparos (WhatsApp + Email)
const { enviarMensagem } = require('./whatsapp');
const { enviarEmail }    = require('./email');
const { supabaseAdmin }  = require('../supabase');
const OpenAI = require('openai');

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Filas em memória: campanhaId → { timer, pausado, indice, instanciaIdx, contatos, config, instancias }
const filas = new Map();

// ---------- Intervalo aleatório ----------
function intervaloAleatorio(minSeg, maxSeg) {
  const min = Number(minSeg) || 180;
  const max = Number(maxSeg) || min;
  const seg = Math.floor(Math.random() * (max - min + 1)) + min;
  return seg * 1000;
}

// ---------- Geração de mensagem WA com IA guiada ----------
async function gerarMensagemWA({ nomeFantasia, razaoSocial, municipio, estado, segmento }, contextoIA, inspiracaoTexto) {
  const nome   = nomeFantasia || razaoSocial || 'estabelecimento';
  const local  = municipio ? `${municipio}${estado ? '/' + estado : ''}` : '';
  const seg    = segmento ? segmento.toLowerCase() : 'negócio';

  const contexto   = contextoIA      || 'software house especializada em sistemas de gestão (PDV) para bares, restaurantes e comércios';
  const inspiracao = inspiracaoTexto || 'seja direto e amigável, desperte curiosidade sobre o sistema de gestão. Assine como Douglas da Fantoni Software.';

  const prompt = `Você é um consultor comercial especializado em: ${contexto}

Seu objetivo é prospectar este lead pelo WhatsApp:
- Nome do estabelecimento: ${nome}
- Segmento: ${seg}
- Cidade: ${local || 'não informada'}

Instruções de abordagem: ${inspiracao}

Regras obrigatórias:
- Máximo 3 linhas
- Chame pelo nome do estabelecimento (não use pronomes genéricos)
- Máximo 1 emoji
- NÃO mencione preço
- Retorne APENAS o texto da mensagem, sem aspas nem formatação extra`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 180,
    temperature: 0.85,
  });
  return completion.choices[0].message.content.trim();
}

// ---------- Geração de mensagem Email com IA guiada ----------
async function gerarMensagemEmail({ nomeFantasia, razaoSocial, municipio, estado, segmento }, contextoIA, inspiracaoTexto) {
  const nome   = nomeFantasia || razaoSocial || 'Estabelecimento';
  const local  = municipio ? `${municipio}${estado ? '/' + estado : ''}` : '';
  const seg    = segmento ? segmento.toLowerCase() : 'negócio';

  const contexto   = contextoIA      || 'software house especializada em sistemas de gestão (PDV) para bares, restaurantes e comércios';
  const inspiracao = inspiracaoTexto || 'foque no problema de controle de vendas e estoque, seja profissional mas próximo';

  const prompt = `Você é um consultor comercial especializado em: ${contexto}

Escreva 2-3 frases para o corpo de um email de prospecção para:
- Nome: ${nome}
- Segmento: ${seg}
- Cidade: ${local || 'não informada'}

Instruções de abordagem: ${inspiracao}

Regras:
- NÃO inclua saudação (já está no template de email)
- NÃO mencione preço
- Retorne APENAS o texto corrido, sem formatação extra`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.75,
  });
  return completion.choices[0].message.content.trim();
}

// ---------- Normaliza telefone para formato internacional ----------
function normalizarTelefone(tel) {
  if (!tel) return null;
  const primeiro = String(tel).split(/[,;]/)[0].trim();
  const numeros  = primeiro.replace(/\D/g, '');
  if (numeros.length < 8) return null;
  if (numeros.startsWith('55') && numeros.length >= 12) return numeros;
  if (numeros.length >= 10) return '55' + numeros;
  return null;
}

// ---------- Persiste status no Supabase ----------
async function atualizarStatusLead(campanhaId, leadId, status, erro = null) {
  try {
    await supabaseAdmin
      .from('disparos_leads')
      .update({ status, erro: erro || null, atualizado_em: new Date().toISOString() })
      .eq('campanha_id', campanhaId)
      .eq('lead_id', String(leadId));
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
  const agora    = new Date();
  const [hi, mi] = horaInicio.split(':').map(Number);
  const [hf, mf] = horaFim.split(':').map(Number);
  const minAgora  = agora.getHours() * 60 + agora.getMinutes();
  const minInicio = hi * 60 + mi;
  const minFim    = hf * 60 + mf;
  return minAgora >= minInicio && minAgora <= minFim;
}

// ---------- Processa um contato ----------
async function processarContato(campanhaId, contato, config, instancias) {
  const { canal, contextoIA, inspiracaoTexto } = config;
  const enviarWA   = canal === 'whatsapp' || canal === 'ambos';
  const enviarMail = canal === 'email'    || canal === 'ambos';

  const params = {
    nomeFantasia: contato.nome_fantasia,
    razaoSocial:  contato.razao_social,
    municipio:    contato.municipio,
    estado:       contato.estado,
    segmento:     contato.atividades_principal || '',
  };

  // WhatsApp
  if (enviarWA) {
    const tel = normalizarTelefone(contato.telefones);
    if (tel && instancias.length > 0) {
      const fila = filas.get(campanhaId);
      const idx  = (fila?.instanciaIdx || 0) % instancias.length;
      if (fila) fila.instanciaIdx = idx + 1;
      const inst = instancias[idx];

      try {
        const msgWA = await gerarMensagemWA(params, contextoIA, inspiracaoTexto);
        await enviarMensagem(tel, msgWA, inst.nome_instancia, inst.api_key, inst.base_url);
        await atualizarStatusLead(campanhaId, contato._id, 'enviado_wa');
      } catch (e) {
        await atualizarStatusLead(campanhaId, contato._id, 'erro_wa', e.message);
      }
    }
  }

  // Email
  if (enviarMail && contato.email) {
    try {
      const msgEmail = await gerarMensagemEmail(params, contextoIA, inspiracaoTexto);
      await enviarEmail({ para: contato.email, ...params, mensagemIA: msgEmail });
      await atualizarStatusLead(campanhaId, contato._id, 'enviado_email');
    } catch (e) {
      await atualizarStatusLead(campanhaId, contato._id, 'erro_email', e.message);
    }
  }
}

// ---------- Inicia fila de disparo ----------
async function iniciarFila(campanhaId, contatos, config, instancias) {
  if (filas.has(campanhaId)) pararFila(campanhaId);

  const estado = { indice: 0, pausado: false, instanciaIdx: 0, contatos, config, instancias };
  filas.set(campanhaId, estado);

  await atualizarCampanha(campanhaId, { status: 'ativo', total: contatos.length, enviados: 0, erros: 0 });

  async function proximoEnvio() {
    const fila = filas.get(campanhaId);
    if (!fila || fila.pausado) return;
    if (fila.indice >= fila.contatos.length) {
      await atualizarCampanha(campanhaId, { status: 'concluido' });
      filas.delete(campanhaId);
      return;
    }

    if (!dentroDoHorario(config.horaInicio, config.horaFim)) {
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
      const delay = intervaloAleatorio(config.intervaloMinSeg, config.intervaloMaxSeg);
      fila.timer = setTimeout(proximoEnvio, delay);
    } else {
      await atualizarCampanha(campanhaId, { status: 'concluido' });
      filas.delete(campanhaId);
    }
  }

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
  return { total: fila.contatos.length, indice: fila.indice, pausado: fila.pausado };
}

module.exports = {
  iniciarFila, pausarFila, retomarFila, pararFila, statusFila,
  gerarMensagemWA, gerarMensagemEmail,
  normalizarTelefone, processarContato, dentroDoHorario,
};
