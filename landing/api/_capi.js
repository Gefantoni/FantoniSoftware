// api/_capi.js
// Helper servidor para Meta Conversions API (CAPI)
// Arquivos com prefixo _ não são expostos como rotas no Vercel.
//
// Variáveis de ambiente necessárias (Vercel → Settings → Environment Variables):
//   META_PIXEL_ID    = 2035088657416576
//   META_CAPI_TOKEN  = <access token do Gerenciador de Eventos>

import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID    || '2035088657416576';
const TOKEN    = process.env.META_CAPI_TOKEN;

// SHA-256 normalizado (lowercase + trim) — obrigatório pela Meta
function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

// Normaliza telefone: apenas dígitos, prefixo 55 (Brasil)
function normalizePhone(phone) {
  if (!phone) return undefined;
  const digits = String(phone).replace(/\D/g, '');
  return digits.startsWith('55') ? digits : '55' + digits;
}

/**
 * Envia um evento para a Meta Conversions API.
 *
 * @param {object} options
 * @param {string}  options.eventName   - Ex: 'Lead', 'InitiateCheckout', 'Purchase'
 * @param {string}  options.eventId     - ID único para deduplicação com o Pixel do browser
 * @param {string}  [options.sourceUrl] - URL da página onde ocorreu o evento
 * @param {object}  options.userData    - { email, phone, name, fbp, fbc }
 * @param {string}  [options.ip]        - IP do cliente (req.headers['x-forwarded-for'])
 * @param {string}  [options.userAgent] - User-agent do cliente
 * @param {object}  [options.customData]- Dados extras (value, currency, content_ids…)
 */
export async function sendCapiEvent({ eventName, eventId, sourceUrl, userData = {}, ip, userAgent, customData }) {
  if (!TOKEN) {
    console.warn('[CAPI] META_CAPI_TOKEN não configurado — evento ignorado');
    return null;
  }

  const phone     = normalizePhone(userData.phone);
  const nameParts = (userData.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || undefined;
  const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

  const userDataPayload = {
    em: userData.email ? [sha256(userData.email)] : undefined,
    ph: phone          ? [sha256(phone)]           : undefined,
    fn: firstName      ? [sha256(firstName)]        : undefined,
    ln: lastName       ? [sha256(lastName)]         : undefined,
    client_ip_address: ip        || undefined,
    client_user_agent: userAgent || undefined,
    fbp: userData.fbp  || undefined,
    fbc: userData.fbc  || undefined,
  };

  // Remove chaves undefined (Meta rejeita campos nulos)
  Object.keys(userDataPayload).forEach(k => {
    if (userDataPayload[k] === undefined) delete userDataPayload[k];
  });

  const event = {
    event_name:       eventName,
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    action_source:    'website',
    event_source_url: sourceUrl || 'https://fantonisoftware.com.br/',
    user_data:        userDataPayload,
  };
  if (customData) event.custom_data = customData;

  const payload = {
    data:         [event],
    access_token: TOKEN,
  };

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    const result = await resp.json();
    if (!resp.ok) console.error('[CAPI] Erro:', JSON.stringify(result));
    else          console.log(`[CAPI] ${eventName} → events_received: ${result.events_received}`);
    return result;
  } catch (err) {
    console.error('[CAPI] Fetch error:', err.message);
    return null;
  }
}
