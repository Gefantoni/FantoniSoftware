// api/lead.js
// Jornada de Teste Grátis — captura de lead, salva no Supabase e retorna links de download

const DOWNLOAD_LINKS = {
  windows: process.env.DOWNLOAD_WINDOWS || 'https://navivendas.com.br/download/windows/pdvmais',
  android: process.env.DOWNLOAD_ANDROID || 'https://play.google.com/store/apps/details?id=br.com.desenvolvedorpdv.pdvmais',
  ios:     process.env.DOWNLOAD_IOS     || 'https://apps.apple.com/br/app/pdv/id6443721199',
};

// Validações
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

function isValidCpfCnpj(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14;
}

// Salva lead no Supabase via REST API
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
      created_at: lead.createdAt,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Supabase insert error:', errText);
    throw new Error(`Supabase ${resp.status}: ${errText}`);
  }
}

// Opcional: envia o lead para um webhook externo (N8N, Typebot, etc.)
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

  const { name, email, whatsapp, cpfCnpj } = req.body ?? {};

  // --- Validação dos campos ---
  const errors = [];

  if (!name || name.trim().length < 2)          errors.push('Nome inválido ou ausente.');
  if (!email || !isValidEmail(email))            errors.push('E-mail inválido ou ausente.');
  if (!whatsapp || !isValidPhone(whatsapp))      errors.push('WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).');
  if (!cpfCnpj || !isValidCpfCnpj(cpfCnpj))     errors.push('CPF/CNPJ inválido. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // --- Dados normalizados ---
  const lead = {
    name:      name.trim(),
    email:     email.trim().toLowerCase(),
    whatsapp:  whatsapp.replace(/\D/g, ''),
    cpfCnpj:   cpfCnpj.replace(/\D/g, ''),
    createdAt: new Date().toISOString(),
  };

  // --- Salva no Supabase e notifica webhook em paralelo ---
  const [supabaseResult] = await Promise.allSettled([
    saveToSupabase(lead),
    notifyWebhook(lead),
  ]);

  // --- Retorna links de download ---
  return res.status(200).json({
    success: true,
    message: 'Acesso liberado! Baixe o app para começar.',
    downloads: DOWNLOAD_LINKS,
    _debug: {
      supabase_url_set: !!process.env.SUPABASE_URL,
      supabase_key_set: !!process.env.SUPABASE_SERVICE_KEY,
      supabase_status: supabaseResult?.status,
      supabase_reason: supabaseResult?.reason?.message ?? null,
    },
  });
}
