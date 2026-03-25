// api/checkout.js
// Jornada de Assinatura — cria cliente + assinatura no Asaas, salva no Supabase e retorna link de pagamento

// Planos disponíveis
const PLANS = {
  'mei':                { label: 'MEI',                 value: 99.00,  meses: null },
  'essencial':          { label: 'Essencial',           value: 119.00, meses: null },
  'premium':            { label: 'Premium',             value: 139.00, meses: null },
  'mei-semestral':      { label: 'MEI Semestral',       value: 89.00,  meses: 6    },
  'essencial-semestral':{ label: 'Essencial Semestral', value: 109.00, meses: 6    },
  'premium-semestral':  { label: 'Premium Semestral',   value: 119.00, meses: 6    },
  'mei-anual':          { label: 'MEI Anual',           value: 79.00,  meses: 12   },
  'essencial-anual':    { label: 'Essencial Anual',     value: 99.00,  meses: 12   },
  'premium-anual':      { label: 'Premium Anual',       value: 109.00, meses: 12   },
};

const ORDER_BUMP_VALUE = 199.00; // Implantação Guiada (taxa única)

// Retorna a data de hoje (primeira cobrança imediata)
function today() {
  return new Date().toISOString().split('T')[0];
}

// Retorna o próximo dia 10 (cobrança recorrente fixa)
function nextDay10() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth(), 10);
  if (d.getDate() >= 10) next.setMonth(next.getMonth() + 1);
  return next.toISOString().split('T')[0];
}

// Data final da assinatura limitada: (meses - 1) recorrências após o próximo dia 10
// (1ª cobrança é feita hoje, então o contrato tem meses-1 cobranças mensais restantes)
function subscriptionEndDate(meses) {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth(), 10);
  if (d.getDate() >= 10) next.setMonth(next.getMonth() + 1);
  next.setMonth(next.getMonth() + (meses - 2)); // -1 pq começa no próximo dia10, -1 do índice
  return next.toISOString().split('T')[0];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCpfCnpj(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14;
}

// Salva o checkout no Supabase (não bloqueia a resposta)
async function saveCheckoutToSupabase(data) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;

  try {
    const resp = await fetch(`${url}/rest/v1/checkouts`, {
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
    console.error('ASAAS_API_KEY não configurada');
    return res.status(500).json({ success: false, error: 'Configuração interna ausente.' });
  }

  const BASE_URL = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';

  const { name, email, cpfCnpj, plan, orderBump } = req.body ?? {};

  // --- Validação ---
  const errors = [];
  if (!name || name.trim().length < 2)       errors.push('Nome inválido ou ausente.');
  if (!email || !isValidEmail(email))         errors.push('E-mail inválido ou ausente.');
  if (!cpfCnpj || !isValidCpfCnpj(cpfCnpj)) errors.push('CPF/CNPJ inválido.');
  if (!plan || !PLANS[plan])                  errors.push(`Plano inválido. Use: ${Object.keys(PLANS).join(', ')}.`);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const selectedPlan = PLANS[plan];
  const hasOrderBump = orderBump === true;

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

    let invoiceUrl  = null;
    let asaasId     = null;
    let totalCharge = selectedPlan.value;

    // ── 2a. Primeira cobrança: hoje ────────────────────────────────────────
    const firstValue = hasOrderBump
      ? selectedPlan.value + ORDER_BUMP_VALUE
      : selectedPlan.value;

    const firstDesc = hasOrderBump
      ? `${selectedPlan.label} — 1º pagamento + Implantação Guiada`
      : `${selectedPlan.label} — 1º pagamento`;

    const firstChargeResp = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        customer:          customer.id,
        billingType:       'UNDEFINED',
        value:             firstValue,
        dueDate:           today(),
        description:       firstDesc,
        externalReference: `checkout_${plan}_first`,
      }),
    });

    const firstCharge = await firstChargeResp.json();

    if (firstCharge.errors) {
      return res.status(400).json({
        success: false,
        error: firstCharge.errors[0]?.description ?? 'Erro ao criar cobrança inicial.',
      });
    }

    invoiceUrl  = firstCharge.invoiceUrl;
    asaasId     = firstCharge.id;
    totalCharge = firstValue;

    // ── 2b. Assinatura recorrente a partir do próximo dia 10 ───────────
    const subBody = {
      customer:          customer.id,
      billingType:       'UNDEFINED',
      value:             selectedPlan.value,
      nextDueDate:       nextDay10(),
      cycle:             'MONTHLY',
      description:       `Assinatura ${selectedPlan.label} — Fantoni PDV`,
      externalReference: `subscription_${plan}`,
    };

    // Plano com duração limitada (semestral/anual): define data final da assinatura
    if (selectedPlan.meses) {
      subBody.endDate = subscriptionEndDate(selectedPlan.meses);
    }

    fetch(`${BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(subBody),
    }).catch(err => console.warn('Erro ao criar assinatura recorrente:', err.message));

    if (!invoiceUrl) {
      return res.status(500).json({
        success: false,
        error: 'Não foi possível obter o link de pagamento. Tente novamente.',
      });
    }

    // ── 3. Salva no Supabase (background, não bloqueia) ─────────────────
    saveCheckoutToSupabase({
      name:        name.trim(),
      email:       email.trim().toLowerCase(),
      cpf_cnpj:    cpfCnpj.replace(/\D/g, ''),
      plan,
      plan_label:  selectedPlan.label,
      plan_value:  selectedPlan.value,
      order_bump:  hasOrderBump,
      total_value: totalCharge,
      invoice_url: invoiceUrl,
      asaas_id:    asaasId,
      customer_id: customer.id,
      status:      'pending',
      origem:      'Checkout Site',
      created_at:  new Date().toISOString(),
    });

    return res.status(200).json({ success: true, invoiceUrl });

  } catch (err) {
    console.error('Erro interno no checkout:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
  }
}
