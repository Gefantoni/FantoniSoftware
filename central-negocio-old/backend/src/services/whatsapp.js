// Serviço de integração com EvolutionAPI v2 (WhatsApp)
const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL;
const INSTANCE  = process.env.EVOLUTION_INSTANCE;
const API_KEY   = process.env.EVOLUTION_API_KEY;

// Envia mensagem de texto para um número
// Aceita parâmetros por instância ou cai no padrão do .env
async function enviarMensagem(numero, mensagem, instNome = INSTANCE, apiKey = API_KEY, baseUrl = BASE_URL) {
  const url     = `${baseUrl}/message/sendText/${instNome}`;
  const payload = { number: numero, text: mensagem };
  const config  = { headers: { apikey: apiKey, 'Content-Type': 'application/json' } };

  try {
    const { data } = await axios.post(url, payload, config);
    return data;
  } catch (err) {
    console.error(`[EVOLUTION_ERROR] URL: ${url} | Status: ${err.response?.status}`);
    console.error('[EVOLUTION_ERROR] Body:', JSON.stringify(err.response?.data || err.message));
    throw new Error(`Erro ao enviar mensagem WhatsApp: ${err.response?.data?.message || err.message}`);
  }
}

// Verifica se a instância está conectada
async function verificarConexao(instNome = INSTANCE, apiKey = API_KEY, baseUrl = BASE_URL) {
  try {
    const { data } = await axios.get(`${baseUrl}/instance/connectionState/${instNome}`, {
      headers: { apikey: apiKey }
    });
    return data?.state || 'unknown';
  } catch (err) {
    console.error('[EVOLUTION_ERROR] verificarConexao:', err.message);
    return 'error';
  }
}

// Disparo em massa a partir de lista [{numero, nome}]
// Suporta parâmetros de instância por chamada (multi-tenant)
async function dispararEmMassa(contatos, templateMensagem, instNome = INSTANCE, apiKey = API_KEY, baseUrl = BASE_URL, onProgresso) {
  const resultados = [];

  for (const contato of contatos) {
    const mensagem = templateMensagem.replace(/\{\{nome\}\}/gi, contato.nome || '');
    try {
      await enviarMensagem(contato.numero, mensagem, instNome, apiKey, baseUrl);
      resultados.push({ numero: contato.numero, status: 'enviado' });
    } catch (err) {
      resultados.push({ numero: contato.numero, status: 'erro', erro: err.message });
    }

    if (onProgresso) onProgresso(resultados.length, contatos.length);

    // Aguarda entre 1-3s (intervalo aleatório) para evitar bloqueio pela operadora
    const delay = 1000 + Math.floor(Math.random() * 2000);
    await new Promise(r => setTimeout(r, delay));
  }

  return resultados;
}

// ── Envia mídia (imagem, vídeo, áudio, documento) via EvoAPI v2 ───────────────
async function enviarMidia(numero, { tipo, url, base64, mimetype, caption, filename } = {}, instNome = INSTANCE, apiKey = API_KEY, baseUrl = BASE_URL) {
  const endpoint = tipo === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';
  const reqUrl   = `${baseUrl}/message/${endpoint}/${instNome}`;

  const payload = { number: numero };
  if (tipo === 'audio') {
    payload.audio = url || (`data:${mimetype || 'audio/ogg'};base64,` + base64);
  } else {
    payload.mediatype = tipo === 'imagem' ? 'image' : tipo === 'video' ? 'video' : 'document';
    payload.media     = url || (`data:${mimetype || 'application/octet-stream'};base64,` + base64);
    if (caption)  payload.caption  = caption;
    if (filename) payload.fileName = filename;
  }

  try {
    const { data } = await axios.post(reqUrl, payload, {
      headers: { apikey: apiKey, 'Content-Type': 'application/json' }
    });
    return data;
  } catch (err) {
    console.error(`[EVOLUTION_ERROR] enviarMidia | URL: ${reqUrl} | Status: ${err.response?.status}`);
    console.error('[EVOLUTION_ERROR] Body:', JSON.stringify(err.response?.data || err.message));
    throw new Error(`Erro ao enviar mídia WhatsApp: ${err.response?.data?.message || err.message}`);
  }
}

// ── Detecta e remove tags de mídia do texto da IA ────────────────────────────
const TAGS_MIDIA = ['SEND_VIDEO_DEMO', 'SEND_FOTO_IMPRESSORA', 'SEND_AUDIO_PROVA', 'SEND_CARDAPIO_DEMO', 'SEND_LINK_TESTE'];

function extrairTagsMidia(texto) {
  if (!texto) return { textoLimpo: texto, tags: [] };
  const tags = [];
  let textoLimpo = texto;
  for (const tag of TAGS_MIDIA) {
    if (textoLimpo.includes(`[${tag}]`)) {
      tags.push(tag);
      textoLimpo = textoLimpo.replace(new RegExp(`\\[${tag}\\]`, 'g'), '').trim();
    }
  }
  // Remove linhas vazias extras deixadas pelas tags removidas
  textoLimpo = textoLimpo.replace(/\n{3,}/g, '\n\n').trim();
  return { textoLimpo, tags };
}

// ── Envia resposta da IA: texto limpo + mídias em sequência ──────────────────
// configMidias: { SEND_VIDEO_DEMO: { tipo, url, caption }, ... }  (vem do Supabase)
async function enviarRespostaComMidias(numero, respostaIA, configMidias = {}, instNome = INSTANCE, apiKey = API_KEY, baseUrl = BASE_URL) {
  const { textoLimpo, tags } = extrairTagsMidia(respostaIA);

  if (textoLimpo) {
    await enviarMensagem(numero, textoLimpo, instNome, apiKey, baseUrl);
  }

  for (const tag of tags) {
    const cfg = configMidias[tag];
    if (!cfg) {
      console.warn(`[MIDIA] Tag ${tag} sem config cadastrada — ignorando`);
      continue;
    }
    try {
      if (cfg.tipo === 'link') {
        const msg = cfg.caption ? `${cfg.caption}\n${cfg.url}` : cfg.url;
        await enviarMensagem(numero, msg, instNome, apiKey, baseUrl);
      } else {
        await enviarMidia(numero, cfg, instNome, apiKey, baseUrl);
      }
      console.log(`[MIDIA] ✓ ${tag} enviada para ${numero}`);
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`[MIDIA] Erro ao enviar ${tag}:`, err.message);
    }
  }
}

module.exports = { enviarMensagem, enviarMidia, enviarRespostaComMidias, extrairTagsMidia, verificarConexao, dispararEmMassa };
