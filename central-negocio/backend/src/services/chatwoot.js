// Serviço de integração com Chatwoot
const axios = require('axios');

const BASE_URL    = process.env.CHATWOOT_URL;
const API_TOKEN   = process.env.CHATWOOT_API_TOKEN;
const headers = { api_access_token: API_TOKEN, 'Content-Type': 'application/json' };

// Cria ou busca contato no Chatwoot
async function buscarOuCriarContato(accountId, { nome, telefone, email }) {
  try {
    // Busca por telefone
    const { data: resultado } = await axios.get(
      `${BASE_URL}/api/v1/accounts/${accountId}/contacts/search`,
      { headers, params: { q: telefone, include_contacts: true } }
    );

    if (resultado.payload?.length > 0) return resultado.payload[0];

    // Cria novo contato
    const { data } = await axios.post(
      `${BASE_URL}/api/v1/accounts/${accountId}/contacts`,
      { name: nome, phone_number: telefone, email },
      { headers }
    );
    return data;
  } catch (err) {
    console.error('Chatwoot buscarOuCriarContato:', err.response?.data || err.message);
    throw new Error('Erro ao buscar/criar contato no Chatwoot');
  }
}

// Cria uma conversa no Chatwoot
async function criarConversa(accountId, { contactId, inboxId, mensagem }) {
  try {
    const { data: conversa } = await axios.post(
      `${BASE_URL}/api/v1/accounts/${accountId}/conversations`,
      { contact_id: contactId, inbox_id: inboxId },
      { headers }
    );

    // Envia mensagem inicial
    if (mensagem) {
      await axios.post(
        `${BASE_URL}/api/v1/accounts/${accountId}/conversations/${conversa.id}/messages`,
        { content: mensagem, message_type: 'outgoing', private: false },
        { headers }
      );
    }

    return conversa;
  } catch (err) {
    console.error('Chatwoot criarConversa:', err.response?.data || err.message);
    throw new Error('Erro ao criar conversa no Chatwoot');
  }
}

module.exports = { buscarOuCriarContato, criarConversa };
