// api/checkout.js
// Checkout para Fantoni PDV
// Regras:
// 1. Planos Mensais: Cobrança imediata + Assinatura Recorrente (todo dia 10)
// 2. Planos Semestrais/Anuais: Cobrança única (sem recorrência) - conforme pedido anterior.

const PLANS = {
  'mei':                { label: 'MEI',                 value: 99.00,  meses: null }, // Mensal com assinatura
  'essencial':          { label: 'Essencial',           value: 119.00, meses: null },
  'premium':            { label: 'Premium',             value: 139.00, meses: null },
  
  'mei-semestral':      { label: 'MEI Semestral',       value: 89.00,  meses: 6    }, // Único
  'essencial-semestral':{ label: 'Essencial Semestral', value: 109.00, meses: 6    },
  'premium-semestral':  { label: 'Premium Semestral',   value: 119.00, meses: 6    },
  
  'mei-anual':          { label: 'MEI Anual',           value: 79.00,  meses: 12   }, // Único
  'essencial-anual':    { label: 'Essencial Anual',     value: 99.00,  meses: 12   },
  'premium-anual':      { label: 'Premium Anual',       value: 109.00, meses: 12   },
};

const ORDER_BUMP_VALUE = 199.00;

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
    await fetch(`${url}/rest/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('Supabase falhou (não crítico):', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const API_KEY = process.env.ASAAS_API_KEY;
  const BASE_URL = process.env.ASAAS_BASE_URL || 'https://www.asaas.com/api/v3';

  const { name, email, cpfCnpj, plan, orderBump } = req.body ?? {};

  const selectedPlan = PLANS[plan];
  if (!selectedPlan) return res.status(400).json({ success: false, error: 'Plano inválido.' });

  const hasOrderBump = orderBump === true;
  const isMonthly    = selectedPlan.meses === null; // No meses = assinatura mensal

  // Valor da primeira cobrança (imediata)
  // Se for mensal, cobra o valor da mensalidade hoje + taxa única
  // Se for semestral/anual, cobra o total acumulado hoje + taxa única
  let firstPaymentValue = isMonthly 
    ? selectedPlan.value 
    : (selectedPlan.value * selectedPlan.meses);

  if (hasOrderBump) firstPaymentValue += ORDER_BUMP_VALUE;

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': API_KEY,
  };

  try {
    // 1. Criar cliente
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
    if (customer.errors) return res.status(400).json({ success: false, error: customer.errors[0].description });

    // 2. Primeira cobrança (Hoje)
    const chargeDesc = isMonthly 
      ? `Acesso Mensal PDV — ${selectedPlan.label}` 
      : `Plano ${selectedPlan.label} — Pagamento Único (${selectedPlan.meses} meses)`;

    const chargeResp = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        customer:          customer.id,
        billingType:       'UNDEFINED',
        value:             firstPaymentValue,
        dueDate:           today(),
        description:       hasOrderBump ? `${chargeDesc} + Implantação Guiada` : chargeDesc,
        externalReference: `pdv_${plan}_first`,
      }),
    });
    const firstCharge = await chargeResp.json();
    if (firstCharge.errors) return res.status(400).json({ success: false, error: firstCharge.errors[0].description });

    // 3. Criar Assinatura Recorrente (APENAS para planos Mensais)
    if (isMonthly) {
      fetch(`${BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer:          customer.id,
          billingType:       'UNDEFINED',
          value:             selectedPlan.value,
          nextDueDate:       nextDay10(),
          cycle:             'MONTHLY',
          description:       `Assinatura Mensal — ${selectedPlan.label}`,
          externalReference: `sub_mensal_${plan}`,
        }),
      }).catch(err => console.error('Erro ao criar assinatura:', err.message));
    }

    // 4. Salva no Supabase
    saveCheckoutToSupabase({
      name, email, 
      cpf_cnpj:    cpfCnpj.replace(/\D/g, ''),
      plan,
      plan_label:  selectedPlan.label,
      plan_value:  selectedPlan.value,
      order_bump:  hasOrderBump,
      total_value: firstPaymentValue,
      invoice_url: firstCharge.invoiceUrl,
      asaas_id:    firstCharge.id,
      customer_id: customer.id,
      status:      'pending',
      origem:      isMonthly ? 'Assinatura Mensal' : 'Plano Único',
      created_at:  new Date().toISOString(),
    });

    return res.status(200).json({ success: true, invoiceUrl: firstCharge.invoiceUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Erro no servidor.' });
  }
}
