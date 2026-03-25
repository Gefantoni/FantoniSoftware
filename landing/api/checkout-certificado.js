// api/checkout-certificado.js
// Checkout para Certificados Digitais — cobrança única (sem assinatura)

const PLANS = {
  'ecpf-a1':  { label: 'e-CPF A1',  value: 139.00 },
  'ecnpj-a1': { label: 'e-CNPJ A1', value: 159.00 },
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCpfCnpj(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14;
}

// Salva o checkout no Supabase
async function saveCheckoutToSupabase(data) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;

  try {
    const resp = await fetch(`${url}/rest/v1/checkouts_certificados`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(data),
    });
    if (!resp.ok) console.error('Supabase checkout error:', await resp.text());
  } catch (err) {
    console.warn('Supabase falhou (não crítico):', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const API_KEY = process.env.ASAAS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ success: false, error: 'Configuração interna ausente.' });
  }

  const BASE_URL = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';

  const { name, email, whatsapp, cpfCnpj, plan } = req.body ?? {};

  // --- Validação ---
  const errors = [];
  if (!name || name.trim().length < 2)       errors.push('Nome inválido.');
  if (!email || !isValidEmail(email))         errors.push('E-mail inválido.');
  if (!whatsapp || whatsapp.length < 8)       errors.push('WhatsApp inválido.');
  if (!cpfCnpj || !isValidCpfCnpj(cpfCnpj)) errors.push('CPF/CNPJ inválido.');
  if (!plan || !PLANS[plan])                  errors.push('Plano inválido.');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const selectedPlan = PLANS[plan];

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': API_KEY,
  };

  try {
    // ── 1. Criar cliente ────────────────────────────────────────────────────
    const customerResp = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        name:     name.trim(),
        email:    email.trim().toLowerCase(),
        phone:    whatsapp.replace(/\D/g, ''),
        cpfCnpj:  cpfCnpj.replace(/\D/g, ''),
      }),
    });

    const customer = await customerResp.json();

    if (customer.errors) {
      return res.status(400).json({
        success: false,
        error: customer.errors[0]?.description ?? 'Erro ao criar cliente no Asaas.',
      });
    }

    // ── 2. Criar cobrança única (emissão imediata) ──────────────────────────
    const chargeResp = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        customer:          customer.id,
        billingType:       'UNDEFINED',
        value:             selectedPlan.value,
        dueDate:           today(),
        description:       `Certificado Digital ${selectedPlan.label} — Fantoni Software`,
        externalReference: `cert_${plan}_${Date.now()}`,
      }),
    });

    const charge = await chargeResp.json();

    if (charge.errors) {
      return res.status(400).json({
        success: false,
        error: charge.errors[0]?.description ?? 'Erro ao criar cobrança.',
      });
    }

    // ── 3. Salva no Supabase ────────────────────────────────────────────────
    saveCheckoutToSupabase({
      name:        name.trim(),
      email:       email.trim().toLowerCase(),
      whatsapp:    whatsapp.replace(/\D/g, ''),
      cpf_cnpj:    cpfCnpj.replace(/\D/g, ''),
      plan,
      plan_label:  selectedPlan.label,
      plan_value:  selectedPlan.value,
      invoice_url: charge.invoiceUrl,
      asaas_id:    charge.id,
      customer_id: customer.id,
      status:      'pending',
      created_at:  new Date().toISOString(),
    });

    return res.status(200).json({ success: true, invoiceUrl: charge.invoiceUrl });

  } catch (err) {
    console.error('Erro no checkout de certificado:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
  }
}
