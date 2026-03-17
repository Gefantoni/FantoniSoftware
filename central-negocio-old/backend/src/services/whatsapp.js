// Serviço de integração com EvolutionAPI (WhatsApp)
const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL;
const INSTANCE  = process.env.EVOLUTION_INSTANCE;
const API_KEY   = process.env.EVOLUTION_API_KEY;

const headers = { apikey: API_KEY, 'Content-Type': 'application/json' };

// Envia mensagem de texto para um número
async function enviarMensagem(numero, mensagem, instNome = INSTANCE, apiKey = API_KEY, baseUrl = BASE_URL) {
  const url = `${baseUrl}/message/sendText/${instNome}`;
  const payload = { number: numero, text: mensagem };
  const config = { headers: { apikey: apiKey, 'Content-Type': 'application/json' } };

  try {
    const { data } = await axios.post(url, payload, config);
    return data;
  } catch (err) {
    console.error(`\n[EVOLUTION_API_ERROR]`);
    console.error(`URL: ${url}`);
    console.error(`Payload:`, JSON.stringify(payload, null, 2));
    console.error(`Status: ${err.response?.status}`);
    console.error(`Response:`, JSON.stringify(err.response?.data || err.message, null, 2));
    throw new Error('Erro ao enviar mensagem WhatsApp');
  }
}

// Disparo em massa a partir de lista [{numero, nome}]
async function dispararEmMassa(contatos, templateMensagem, onProgresso) {
  const resultados = [];
  for (const contato of contatos) {
    const mensagem = templateMensagem.replace(/\{\{nome\}\}/gi, contato.nome || '');
    try {
      await enviarMensagem(contato.numero, mensagem);
      resultados.push({ numero: contato.numero, status: 'enviado' });
    } catch (err) {
      resultados.push({ numero: contato.numero, status: 'erro', erro: err.message });
    }
    // Callback de progresso (opcional)
    if (onProgresso) onProgresso(resultados.length, contatos.length);
    // Aguarda 1s entre envios para evitar bloqueio
    await new Promise(r => setTimeout(r, 1000));
  }
  return resultados;
}

module.exports = { enviarMensagem, dispararEmMassa };
