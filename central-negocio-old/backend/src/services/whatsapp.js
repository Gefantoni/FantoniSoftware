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

module.exports = { enviarMensagem, verificarConexao, dispararEmMassa };
