// api/consultor.js
// Captura lead qualificado vindo do botão "Falar com consultor"
// Salva no Supabase + dispara evento Lead na Meta Conversions API

import { sendCapiEvent } from './_capi.js';


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

async function saveLeadConsultor(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn('Supabase não configurado — lead consultor não salvo.');
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
      name:       lead.empresa,
      empresa:    lead.empresa,
      email:      lead.email,
      whatsapp:   lead.whatsapp,
      segmento:   lead.ramo,
      origem:     'Consultor Site',
      created_at: new Date().toISOString(),
      ...lead.campanha,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Supabase insert error (consultor):', errText);
    throw new Error(`Supabase ${resp.status}: ${errText}`);
  }
}

async function notifyWebhook(lead) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, origem: 'Consultor Site' }),
    });
  } catch (err) {
    console.warn('Webhook consultor falhou (não crítico):', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { empresa, ramo, email, whatsapp, _meta } = req.body ?? {};

  const errors = [];
  if (!empresa || empresa.trim().length < 2)  errors.push('Nome da empresa inválido.');
  if (!ramo || ramo.trim().length < 2)        errors.push('Ramo de atuação obrigatório.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('E-mail inválido.');
  if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) errors.push('Telefone inválido.');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const lead = {
    empresa:  empresa.trim(),
    ramo:     ramo.trim(),
    email:    email.trim().toLowerCase(),
    whatsapp: whatsapp.replace(/\D/g, ''),
    campanha: dadosCampanha(req.body),
  };

  // IP real do cliente (considera proxy Vercel)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

  const [gravacao] = await Promise.allSettled([
    saveLeadConsultor(lead),
    notifyWebhook(lead),
    sendCapiEvent({
      eventName: 'Lead',
      eventId:   _meta?.event_id || `consultor_${Date.now()}`,
      sourceUrl: _meta?.page_url,
      userData:  {
        name:  lead.empresa,
        email: lead.email,
        phone: lead.whatsapp,
        fbp:   _meta?.fbp,
        fbc:   _meta?.fbc,
      },
      ip,
      userAgent: _meta?.user_agent || req.headers['user-agent'],
    }),
  ]);

  // Se a gravação falhar, não devolvemos sucesso — senão o lead some em silêncio.
  if (gravacao.status === 'rejected') {
    console.error('[consultor] Falha ao gravar lead:', JSON.stringify({
      empresa:  lead.empresa,
      ramo:     lead.ramo,
      email:    lead.email,
      whatsapp: lead.whatsapp,
      erro:     gravacao.reason?.message || String(gravacao.reason),
    }));
    return res.status(502).json({
      success: false,
      errors: ['Não conseguimos registrar seu contato agora. Chame a gente no WhatsApp (51) 99603-4862.'],
    });
  }

  return res.status(200).json({ success: true });
}
