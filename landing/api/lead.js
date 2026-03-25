// api/lead.js
// Jornada de Teste Grátis — captura de lead e retorno dos links de download

const DOWNLOAD_LINKS = {
  windows: process.env.DOWNLOAD_WINDOWS || 'https://fantoni.app/download/windows',
  android: process.env.DOWNLOAD_ANDROID || 'https://fantoni.app/download/android',
  ios:     process.env.DOWNLOAD_IOS     || 'https://fantoni.app/download/ios',
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

// Opcional: envia o lead para um webhook externo (N8N, Typebot, etc.)
async function notifyWebhook(lead) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return; // sem webhook configurado, ignora silenciosamente

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

  if (!name || name.trim().length < 2) {
    errors.push('Nome inválido ou ausente.');
  }
  if (!email || !isValidEmail(email)) {
    errors.push('E-mail inválido ou ausente.');
  }
  if (!whatsapp || !isValidPhone(whatsapp)) {
    errors.push('WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).');
  }
  if (!cpfCnpj || !isValidCpfCnpj(cpfCnpj)) {
    errors.push('CPF/CNPJ inválido. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // --- Dados normalizados ---
  const lead = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    whatsapp: whatsapp.replace(/\D/g, ''),
    cpfCnpj: cpfCnpj.replace(/\D/g, ''),
    createdAt: new Date().toISOString(),
  };

  // --- Notifica webhook (N8N / Typebot / CRM) ---
  await notifyWebhook(lead);

  // --- Retorna links de download ---
  return res.status(200).json({
    success: true,
    message: 'Acesso liberado! Baixe o app para começar.',
    downloads: DOWNLOAD_LINKS,
  });
}
