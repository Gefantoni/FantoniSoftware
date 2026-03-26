// api/consultor.js
// Captura lead qualificado vindo do botão "Falar com consultor"
// Salva no Supabase + dispara evento Lead na Meta Conversions API

import { sendCapiEvent } from './_capi.js';

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
      name:      lead.nome,
      whatsapp:  lead.whatsapp,
      segmento:  lead.ramo,
      notas:     `Faturamento: ${lead.faturamento}`,
      origem:    'Consultor Site',
      created_at: new Date().toISOString(),
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

  const { nome, faturamento, ramo, whatsapp, _meta } = req.body ?? {};

  const errors = [];
  if (!nome || nome.trim().length < 2)       errors.push('Nome inválido.');
  if (!faturamento)                           errors.push('Faturamento obrigatório.');
  if (!ramo || ramo.trim().length < 2)        errors.push('Ramo de atuação obrigatório.');
  if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) errors.push('WhatsApp inválido.');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const lead = {
    nome:        nome.trim(),
    faturamento: faturamento.trim(),
    ramo:        ramo.trim(),
    whatsapp:    whatsapp.replace(/\D/g, ''),
  };

  // IP real do cliente (considera proxy Vercel)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

  await Promise.allSettled([
    saveLeadConsultor(lead),
    notifyWebhook(lead),
    sendCapiEvent({
      eventName: 'Lead',
      eventId:   _meta?.event_id || `consultor_${Date.now()}`,
      sourceUrl: _meta?.page_url,
      userData:  {
        name:  lead.nome,
        phone: lead.whatsapp,
        fbp:   _meta?.fbp,
        fbc:   _meta?.fbc,
      },
      ip,
      userAgent: _meta?.user_agent || req.headers['user-agent'],
    }),
  ]);

  return res.status(200).json({ success: true });
}
