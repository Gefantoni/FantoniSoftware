// Rotas para leads e checkouts vindos da landing page (fantonisoftware.com.br)
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// GET /landing/leads — leads que ativaram período teste
router.get('/leads', autenticar, adminOuComercial, async (req, res) => {
  const { busca } = req.query;
  const limit  = Math.min(Number(req.query.limit)  || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0,   0);
  try {
    let query = supabaseAdmin
      .from('leads')
      .select('id, name, email, whatsapp, cpf_cnpj, origem, created_at', { count: 'exact' })
      .not('name', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (busca) {
      query = query.or(`name.ilike.%${busca}%,email.ilike.%${busca}%,whatsapp.ilike.%${busca}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ leads: data || [], total: count || 0 });
  } catch (e) {
    console.error('Erro ao buscar leads landing:', e.message);
    res.status(500).json({ erro: 'Erro ao buscar leads' });
  }
});

// GET /landing/checkouts — clientes que iniciaram checkout
router.get('/checkouts', autenticar, adminOuComercial, async (req, res) => {
  const { busca, status } = req.query;
  const limit  = Math.min(Number(req.query.limit)  || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0,   0);
  try {
    let query = supabaseAdmin
      .from('checkouts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (busca)  query = query.or(`name.ilike.%${busca}%,email.ilike.%${busca}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ checkouts: data || [], total: count || 0 });
  } catch (e) {
    console.error('Erro ao buscar checkouts landing:', e.message);
    res.status(500).json({ erro: 'Erro ao buscar checkouts' });
  }
});

module.exports = router;
