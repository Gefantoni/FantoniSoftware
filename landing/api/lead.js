// api/lead.js
// Jornada de Teste Grátis — captura de lead, salva no Supabase,
// dispara evento Lead na Meta Conversions API e retorna links de download

import { sendCapiEvent } from './_capi.js';

const DOWNLOAD_LINKS = {
  windows: process.env.DOWNLOAD_WINDOWS || 'https://navivendas.com.br/download/windows/pdvmais',
  android: process.env.DOWNLOAD_ANDROID || 'https://play.google.com/store/apps/details?id=br.com.desenvolvedorpdv.pdvmais',
  ios:     process.env.DOWNLOAD_IOS     || 'https://apps.apple.com/br/app/pdv/id6443721199',
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

function isValidCpfCnpj(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

function isValidCpf(d) {
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  return r === parseInt(d[10]);
}

function isValidCnpj(d) {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i]) * w1[i];
  let r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (r !== parseInt(d[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i]) * w2[i];
  r = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return r === parseInt(d[13]);
}

async function saveToSupabase(lead) {
  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn('Supabase não configurado — lead não salvo.');
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
      name:       lead.name,
      email:      lead.email,
      whatsapp:   lead.whatsapp,
      cpf_cnpj:   lead.cpfCnpj,
      origem:     'Teste Site',
      created_at: lead.createdAt,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Supabase insert error:', errText);
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
      body: JSON.stringify(lead),
    });
  } catch (err) {
    console.warn('Webhook de lead falhou (não crítico):', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { name, email, whatsapp, cpfCnpj, _meta } = req.body ?? {};

  const errors = [];
  if (!name || name.trim().length < 2)          errors.push('Nome inválido ou ausente.');
  if (!email || !isValidEmail(email))            errors.push('E-mail inválido ou ausente.');
  if (!whatsapp || !isValidPhone(whatsapp))      errors.push('WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).');
  if (!cpfCnpj || !isValidCpfCnpj(cpfCnpj))     errors.push('CPF/CNPJ inválido. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const lead = {
    name:      name.trim(),
    email:     email.trim().toLowerCase(),
    whatsapp:  whatsapp.replace(/\D/g, ''),
    cpfCnpj:   cpfCnpj.replace(/\D/g, ''),
    createdAt: new Date().toISOString(),
  };

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

  await Promise.allSettled([
    saveToSupabase(lead),
    notifyWebhook(lead),
    sendCapiEvent({
      eventName: 'Lead',
      eventId:   _meta?.event_id || `lead_${Date.now()}`,
      sourceUrl: _meta?.page_url,
      userData:  {
        name:  lead.name,
        email: lead.email,
        phone: lead.whatsapp,
        fbp:   _meta?.fbp,
        fbc:   _meta?.fbc,
      },
      ip,
      userAgent: _meta?.user_agent || req.headers['user-agent'],
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: 'Acesso liberado! Baixe o app para começar.',
    downloads: DOWNLOAD_LINKS,
  });
}
