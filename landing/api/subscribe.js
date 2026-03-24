// api/subscribe.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, cpfCnpj, plan } = req.body;
  const API_KEY = process.env.ASAAS_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'ASAAS_API_KEY not configured on Vercel' });
  }

  const BASE_URL = 'https://www.asaas.com/api/v3';

  try {
    // 1. Create or Find Customer
    const customerResp = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      },
      body: JSON.stringify({ name, email, cpfCnpj })
    });
    const customer = await customerResp.json();

    if (customer.errors) {
       return res.status(400).json({ success: false, error: customer.errors[0].description });
    }

    // 2. Create Subscription
    const value = plan === 'yearly' ? 999.00 : 120.00;
    const cycle = plan === 'yearly' ? 'YEARLY' : 'MONTHLY';

    const subResp = await fetch(`${BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      },
      body: JSON.stringify({
        customer: customer.id,
        billingType: 'UNDEFINED', // Allows customer to choose PIX, Boleto or Card
        value: value,
        nextDueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        cycle: cycle,
        description: `Assinatura Plano ${plan === 'yearly' ? 'Anual' : 'Mensal'} - Navi Vendas`
      })
    });

    const subscription = await subResp.json();

    if (subscription.errors) {
       return res.status(400).json({ success: false, error: subscription.errors[0].description });
    }

    // Return the invoice URL (Asaas payment link for the first charge)
    return res.status(200).json({ success: true, invoiceUrl: subscription.invoiceUrl });

  } catch (error) {
    console.error('Asaas Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
