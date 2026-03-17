// Serviço de integração bidirecional com Chatwoot
// Fluxo:
//   1. WhatsApp → EvoAPI → nosso webhook → sincronizarMensagemRecebida() → Chatwoot
//   2. Agente IA responde → sincronizarRespostaIA() → Chatwoot (marcada como bot)
//   3. Humano responde no Chatwoot → chatwoot-webhook → EvoAPI (forward)
//
// Anti-loop: mensagens criadas via API são marcadas com content_attributes.source = 'ia_sdr'
// O webhook do Chatwoot ignora essas mensagens.

const axios = require('axios');

function config() {
  return {
    url:       process.env.CHATWOOT_URL,
    token:     process.env.CHATWOOT_API_TOKEN,
    accountId: process.env.CHATWOOT_ACCOUNT_ID || '1',
    inboxId:   process.env.CHATWOOT_INBOX_ID
  };
}

function configurado() {
  const { url, token, inboxId } = config();
  return !!(url && token && inboxId);
}

function headers() {
  return { api_access_token: config().token, 'Content-Type': 'application/json' };
}

function base() {
  const { url, accountId } = config();
  return `${url}/api/v1/accounts/${accountId}`;
}

// ── Contatos ─────────────────────────────────────────────────────────────────

async function buscarOuCriarContato(numero, nome) {
  // Busca por número (sem formatação)
  try {
    const { data } = await axios.get(`${base()}/contacts/search`, {
      headers: headers(),
      params: { q: numero, page: 1 }
    });
    const encontrado = (data.payload || []).find(c => {
      const tel = (c.phone_number || '').replace(/\D/g, '');
      return tel === numero || tel === numero.replace(/^55/, '');
    });
    if (encontrado) return encontrado.id;
  } catch {}

  // Cria novo contato
  const { data: contato } = await axios.post(`${base()}/contacts`, {
    name: nome || numero,
    phone_number: `+${numero}`
  }, { headers: headers() });

  return contato.id;
}

// ── Conversas ─────────────────────────────────────────────────────────────────

async function buscarOuCriarConversa(contactId, conversaIdSalvo) {
  // Tenta reusar conversa aberta já salva no lead
  if (conversaIdSalvo) {
    try {
      const { data } = await axios.get(`${base()}/conversations/${conversaIdSalvo}`, { headers: headers() });
      if (data.status === 'open' || data.status === 'pending') return conversaIdSalvo;
    } catch {}
  }

  // Cria nova conversa
  const { data: conversa } = await axios.post(`${base()}/conversations`, {
    contact_id: contactId,
    inbox_id:   Number(config().inboxId),
    status:     'open'
  }, { headers: headers() });

  return conversa.id;
}

// ── Mensagens ─────────────────────────────────────────────────────────────────

// tipo: 'incoming' = do cliente | 'outgoing' = do agente ou bot
// isBot: marca com source='ia_sdr' — o webhook do Chatwoot ignora essas
async function enviarMensagem(conversaId, conteudo, tipo = 'incoming', isBot = false) {
  const { data } = await axios.post(
    `${base()}/conversations/${conversaId}/messages`,
    {
      content:            conteudo,
      message_type:       tipo,
      private:            false,
      content_attributes: isBot ? { source: 'ia_sdr' } : {}
    },
    { headers: headers() }
  );
  return data;
}

// ── Fluxo principal (chamado pelo webhook do WhatsApp) ────────────────────────

// Passo 1: mensagem chegou do WhatsApp → exibe no Chatwoot como "incoming"
// Retorna { contactId, conversaId, msgId } para salvar no lead
async function sincronizarMensagemRecebida(lead, numero, mensagem) {
  if (!configurado()) return null;

  const contactId  = await buscarOuCriarContato(numero, lead.nome);
  const conversaId = await buscarOuCriarConversa(contactId, lead.chatwoot_conversation_id);
  const msg        = await enviarMensagem(conversaId, mensagem, 'incoming', false);

  return { contactId, conversaId, msgId: msg.id };
}

// Passo 2: IA respondeu → exibe no Chatwoot como "outgoing" marcada como bot
async function sincronizarRespostaIA(conversaId, resposta) {
  if (!configurado() || !conversaId) return null;
  const msg = await enviarMensagem(conversaId, resposta, 'outgoing', true);
  return msg.id;
}

// ── Helper para o webhook do Chatwoot ─────────────────────────────────────────

// Obtém o número de telefone do contato a partir de uma conversa
async function obterNumeroDeConversa(conversaId) {
  const { data } = await axios.get(`${base()}/conversations/${conversaId}`, { headers: headers() });
  const tel =
    data?.meta?.sender?.phone_number ||
    data?.contact_inbox?.contact?.phone_number;

  if (!tel) throw new Error(`Conversa ${conversaId} sem telefone no Chatwoot`);
  return tel.replace(/\D/g, '');
}

module.exports = {
  configurado,
  sincronizarMensagemRecebida,
  sincronizarRespostaIA,
  obterNumeroDeConversa
};
