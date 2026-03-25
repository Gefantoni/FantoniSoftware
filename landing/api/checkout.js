// api/checkout.js
// Jornada de Assinatura — cria cliente + assinatura no Asaas, salva no Supabase e retorna link de pagamento

// Planos disponíveis (valores mensais em R$)
const PLANS = {
  mei:       { label: 'MEI',       value: 99.00  },
  essencial: { label: 'Essencial', value: 119.00 },
  premium:   { label: 'Premium',   value: 139.00 },
};

const ORDER_BUMP_VALUE = 199.00; // Implantação Guiada (taxa única)

function futureDate(days = 1) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function nextMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
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

    if (hasOrderBump) {
      // ── 2a. Order Bump: cobrança única (plano + implantação) ───────────
      const firstChargeResp = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer:          customer.id,
          billingType:       'UNDEFINED',
          value:             selectedPlan.value + ORDER_BUMP_VALUE,
          dueDate:           futureDate(1),
          description:       `${selectedPlan.label} — 1º mês + Implantação Guiada`,
          externalReference: `checkout_${plan}_bump`,
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
      totalCharge = selectedPlan.value + ORDER_BUMP_VALUE;

      // Assinatura recorrente a partir do 2º mês (background)
      fetch(`${BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer:          customer.id,
          billingType:       'UNDEFINED',
          value:             selectedPlan.value,
          nextDueDate:       nextMonthDate(),
          cycle:             'MONTHLY',
          description:       `Assinatura ${selectedPlan.label} — Fantoni Software`,
          externalReference: `subscription_${plan}`,
        }),
      }).catch(err => console.warn('Erro ao criar assinatura recorrente:', err.message));

    } else {
      // ── 2b. Assinatura padrão ───────────────────────────────────────────
      const subResp = await fetch(`${BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer:          customer.id,
          billingType:       'UNDEFINED',
          value:             selectedPlan.value,
          nextDueDate:       futureDate(1),
          cycle:             'MONTHLY',
          description:       `Assinatura ${selectedPlan.label} — Fantoni Software`,
          externalReference: `subscription_${plan}`,
        }),
      });

      const subscription = await subResp.json();

      if (subscription.errors) {
        return res.status(400).json({
          success: false,
          error: subscription.errors[0]?.description ?? 'Erro ao criar assinatura.',
        });
      }

      asaasId = subscription.id;

      // Busca primeira cobrança para obter invoiceUrl
      const chargesResp = await fetch(
        `${BASE_URL}/payments?subscription=${subscription.id}&limit=1`,
        { headers: asaasHeaders }
      );
      const chargesData = await chargesResp.json();
      const firstCharge = chargesData.data?.[0];
      invoiceUrl = firstCharge?.invoiceUrl ?? subscription.invoiceUrl ?? null;
    }

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
      created_at:  new Date().toISOString(),
    });

    return res.status(200).json({ success: true, invoiceUrl });

  } catch (err) {
    console.error('Erro interno no checkout:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
  }
}
