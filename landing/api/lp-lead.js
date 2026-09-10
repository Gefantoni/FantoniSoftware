// api/lp-lead.js
// Captura da landing page de campanha — formulário curto de 3 campos.
// Menos atrito de propósito: tráfego pago não tolera formulário longo.

import { sendCapiEvent } from './_capi.js';

const ORIGENS_VALIDAS = {
  'bar-restaurante': 'LP Bar e Restaurante',
};

// Campos de campanha vindos do front (gclid + UTMs) e carimbo de data/hora BRT.
function dadosCampanha(body) {
  const dh = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return {
    gclid:        body?.gclid        || null,
    utm_source:   body?.utm_source   || null,
    utm_medium:   body?.utm_medium   || null,
    utm_campaign: body?.utm_campaign || null,
    utm_term:     body?.utm_term     || null,
    data_hora:    dh.replace(' ', 'T') + '-03:00',
  };
}

async function salvar(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn('Supabase não configurado — lead da LP não salvo.');
    return;
  }

  const resp = await fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      name:       lead.nome,
      whatsapp:   lead.whatsapp,
      segmento:   lead.tipoNegocio,
      origem:     lead.origem,
      created_at: new Date().toISOString(),
      ...lead.campanha,
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    console.error('Supabase insert error (lp-lead):', erro);
    throw new Error(`Supabase ${resp.status}: ${erro}`);
  }
}

async function notifyWebhook(lead) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
  } catch (err) {
    console.warn('Webhook da LP falhou (não crítico):', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { nome, whatsapp, tipoNegocio, lp, _meta } = req.body ?? {};

  const errors = [];
  if (!nome || nome.trim().length < 2) errors.push('Informe o seu nome.');
  if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) errors.push('WhatsApp inválido. Informe DDD + número.');
  if (!tipoNegocio || tipoNegocio.trim().length < 2) errors.push('Informe o tipo do seu negócio.');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const lead = {
    nome:        nome.trim(),
    whatsapp:    whatsapp.replace(/\D/g, ''),
    tipoNegocio: tipoNegocio.trim(),
    origem:      ORIGENS_VALIDAS[lp] || 'LP Campanha',
    campanha:    dadosCampanha(req.body),
  };

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

  const [gravacao] = await Promise.allSettled([
    salvar(lead),
    notifyWebhook(lead),
    sendCapiEvent({
      eventName: 'Lead',
      eventId:   _meta?.event_id || `lp_${Date.now()}`,
      sourceUrl: _meta?.page_url,
      userData:  { name: lead.nome, phone: lead.whatsapp, fbp: _meta?.fbp, fbc: _meta?.fbc },
      ip,
      userAgent: _meta?.user_agent || req.headers['user-agent'],
    }),
  ]);

  if (gravacao.status === 'rejected') {
    console.error('[lp-lead] Falha ao gravar lead:', JSON.stringify({
      nome: lead.nome, whatsapp: lead.whatsapp, tipoNegocio: lead.tipoNegocio,
      erro: gravacao.reason?.message || String(gravacao.reason),
    }));
    return res.status(502).json({
      success: false,
      errors: ['Não conseguimos registrar seu contato agora. Chame a gente no WhatsApp (51) 99603-4862.'],
    });
  }

  return res.status(200).json({ success: true });
}
