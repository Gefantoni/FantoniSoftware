// Rotas de financeiro da empresa (admin)
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuFinanceiro } = require('../middleware/roles');

const router = express.Router();

// GET /financeiro-admin/dashboard — visão geral (receita, despesa, lucro)
router.get('/dashboard', autenticar, adminOuFinanceiro, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = mes ? parseInt(mes) : new Date().getMonth() + 1;
  const anoAtual = ano ? parseInt(ano) : new Date().getFullYear();

  if (mesAtual < 1 || mesAtual > 12 || isNaN(mesAtual))
    return res.status(400).json({ erro: 'Mês inválido (1–12)' });
  if (anoAtual < 2000 || anoAtual > 2100 || isNaN(anoAtual))
    return res.status(400).json({ erro: 'Ano inválido' });

  try {
    // Lançamentos do mês selecionado
    const dataInicio = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
    // Último dia do mês: dia 0 do próximo mês = último dia do mês atual
    const ultimoDia = new Date(anoAtual, mesAtual, 0).getDate();
    const dataFim = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const { data: lancamentos, error } = await supabaseAdmin
      .from('lancamentos')
      .select('*')
      .gte('vencimento', dataInicio)
      .lte('vencimento', dataFim);

    if (error) throw error;

    const receita = lancamentos
      .filter(l => l.tipo === 'receita' && l.status === 'pago')
      .reduce((s, l) => s + parseFloat(l.valor), 0);

    const despesa = lancamentos
      .filter(l => l.tipo === 'despesa' && l.status === 'pago')
      .reduce((s, l) => s + parseFloat(l.valor), 0);

    const receitaPrevista = lancamentos
      .filter(l => l.tipo === 'receita')
      .reduce((s, l) => s + parseFloat(l.valor), 0);

    const inadimplencia = lancamentos
      .filter(l => l.tipo === 'receita' && l.status === 'pendente' && new Date(l.vencimento) < new Date())
      .reduce((s, l) => s + parseFloat(l.valor), 0);

    res.json({
      mes: mesAtual, ano: anoAtual,
      receita, despesa,
      lucro: receita - despesa,
      receitaPrevista,
      inadimplencia
    });
  } catch (err) {
    console.error('Erro no dashboard financeiro:', err.message);
    res.status(500).json({ erro: 'Erro ao gerar dashboard' });
  }
});

// GET /financeiro-admin/lancamentos — lista lançamentos com filtros
router.get('/lancamentos', autenticar, adminOuFinanceiro, async (req, res) => {
  const { tipo, status, categoria, data_inicio, data_fim } = req.query;
  try {
    let query = supabaseAdmin
      .from('lancamentos')
      .select('*, perfis(nome)')
      .order('vencimento', { ascending: false });

    if (tipo)        query = query.eq('tipo', tipo);
    if (status)      query = query.eq('status', status);
    if (categoria)   query = query.eq('categoria', categoria);
    if (data_inicio) query = query.gte('vencimento', data_inicio);
    if (data_fim)    query = query.lte('vencimento', data_fim);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ lancamentos: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar lançamentos' });
  }
});

// POST /financeiro-admin/lancamentos — cria lançamento manual
router.post('/lancamentos', autenticar, adminOuFinanceiro, async (req, res) => {
  const { tipo, categoria, descricao, valor, recorrente, periodicidade, cliente_id, vencimento, status } = req.body;
  if (!tipo || !categoria || !descricao || !valor) {
    return res.status(400).json({ erro: 'tipo, categoria, descricao e valor são obrigatórios' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('lancamentos')
      .insert({ tipo, categoria, descricao, valor: parseFloat(valor), recorrente, periodicidade, cliente_id, vencimento, status: status || 'pendente' })
      .select().single();
    if (error) throw error;
    res.status(201).json({ lancamento: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar lançamento' });
  }
});

// PUT /financeiro-admin/lancamentos/:id
router.put('/lancamentos/:id', autenticar, adminOuFinanceiro, async (req, res) => {
  const { descricao, valor, status, pago_em, vencimento } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('lancamentos')
      .update({ descricao, valor: valor ? parseFloat(valor) : undefined, status, pago_em, vencimento })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ lancamento: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar lançamento' });
  }
});

// DELETE /financeiro-admin/lancamentos/:id
router.delete('/lancamentos/:id', autenticar, adminOuFinanceiro, async (req, res) => {
  try {
    await supabaseAdmin.from('lancamentos').delete().eq('id', req.params.id);
    res.json({ mensagem: 'Lançamento removido' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover lançamento' });
  }
});

// GET /financeiro-admin/dre — demonstrativo de resultado
router.get('/dre', autenticar, adminOuFinanceiro, async (req, res) => {
  const { ano } = req.query;
  const anoConsulta = ano ? parseInt(ano) : new Date().getFullYear();
  if (anoConsulta < 2000 || anoConsulta > 2100 || isNaN(anoConsulta))
    return res.status(400).json({ erro: 'Ano inválido' });

  try {
    const { data, error } = await supabaseAdmin
      .from('lancamentos')
      .select('*')
      .gte('vencimento', `${anoConsulta}-01-01`)
      .lte('vencimento', `${anoConsulta}-12-31`)
      .eq('status', 'pago');

    if (error) throw error;

    // Agrupa por mês
    const dre = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const doMes = data.filter(l => parseInt(l.vencimento?.split('-')[1]) === mes);
      const receita = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor), 0);
      const despesa = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor), 0);
      return { mes, receita, despesa, lucro: receita - despesa };
    });

    res.json({ ano: anoConsulta, dre });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar DRE' });
  }
});

module.exports = router;
