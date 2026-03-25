// api/checkout.js
// Jornada de Assinatura — cria cliente + assinatura no Asaas e retorna link de pagamento

// Planos disponíveis (valores mensais em R$)
const PLANS = {
  mei:       { label: 'MEI',       value: 99.00  },
  essencial: { label: 'Essencial', value: 119.00 },
  premium:   { label: 'Premium',   value: 139.00 },
};

const ORDER_BUMP_VALUE = 199.00; // Implantação Guiada (taxa única)

// Retorna a data de hoje + N dias no formato YYYY-MM-DD
function futureDate(days = 1) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Retorna a data de hoje + 1 mês (início da 2ª cobrança recorrente)
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

  if (!name || name.trim().length < 2) errors.push('Nome inválido ou ausente.');
  if (!email || !isValidEmail(email))   errors.push('E-mail inválido ou ausente.');
  if (!cpfCnpj || !isValidCpfCnpj(cpfCnpj)) errors.push('CPF/CNPJ inválido.');
  if (!plan || !PLANS[plan])            errors.push(`Plano inválido. Use: ${Object.keys(PLANS).join(', ')}.`);

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
    // ── 1. Criar ou reutilizar cliente ──────────────────────────────────────
    const customerResp = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      }),
    });

    const customer = await customerResp.json();

    if (customer.errors) {
      return res.status(400).json({
        success: false,
        error: customer.errors[0]?.description ?? 'Erro ao criar cliente no Asaas.',
      });
    }

    let invoiceUrl = null;

    if (hasOrderBump) {
      // ── 2a. Order Bump ativado ──────────────────────────────────────────
      // Cobrança avulsa: valor do plano + R$199 (implantação)
      // A assinatura recorrente começa apenas no mês seguinte.

      const firstChargeResp = await fetch(`${BASE_URL}/payments`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: customer.id,
          billingType: 'UNDEFINED',
          value: selectedPlan.value + ORDER_BUMP_VALUE,
          dueDate: futureDate(1),
          description: `${selectedPlan.label} — 1º mês + Implantação Guiada`,
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

      invoiceUrl = firstCharge.invoiceUrl;

      // Cria assinatura recorrente a partir do 2º mês (em background, sem bloquear)
      fetch(`${BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: customer.id,
          billingType: 'UNDEFINED',
          value: selectedPlan.value,
          nextDueDate: nextMonthDate(),
          cycle: 'MONTHLY',
          description: `Assinatura ${selectedPlan.label} — Fantoni Software`,
          externalReference: `subscription_${plan}`,
        }),
      }).catch(err => console.warn('Erro ao criar assinatura recorrente:', err.message));

    } else {
      // ── 2b. Assinatura padrão (sem order bump) ──────────────────────────
      const subResp = await fetch(`${BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: customer.id,
          billingType: 'UNDEFINED',
          value: selectedPlan.value,
          nextDueDate: futureDate(1),
          cycle: 'MONTHLY',
          description: `Assinatura ${selectedPlan.label} — Fantoni Software`,
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

      // Busca a primeira cobrança gerada para obter o invoiceUrl
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

    return res.status(200).json({ success: true, invoiceUrl });

  } catch (err) {
    console.error('Erro interno no checkout:', err);
    return res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
  }
}
