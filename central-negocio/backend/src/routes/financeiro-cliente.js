// Rotas de financeiro pessoal do cliente
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// GET /financeiro-cliente — histórico dos últimos meses do cliente logado
router.get('/', autenticar, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('financeiro_cliente')
      .select('*')
      .eq('cliente_id', req.perfil.id)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(12);

    if (error) throw error;
    res.json({ historico: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar financeiro' });
  }
});

// POST /financeiro-cliente — salva ou atualiza lançamento mensal
router.post('/', autenticar, async (req, res) => {
  const { mes, ano, faturamento, custos, meta } = req.body;
  if (!mes || !ano) return res.status(400).json({ erro: 'Mês e ano são obrigatórios' });

  // Calcula margem de lucro
  const fat = parseFloat(faturamento) || 0;
  const cus = parseFloat(custos) || 0;
  const margem_lucro = fat > 0 ? parseFloat(((fat - cus) / fat * 100).toFixed(2)) : 0;

  try {
    const { data, error } = await supabaseAdmin
      .from('financeiro_cliente')
      .upsert({
        cliente_id: req.perfil.id,
        mes: parseInt(mes),
        ano: parseInt(ano),
        faturamento: fat,
        custos: cus,
        margem_lucro,
        meta: parseFloat(meta) || null
      }, { onConflict: 'cliente_id,mes,ano' })
      .select().single();

    if (error) throw error;
    res.json({ lancamento: data });
  } catch (err) {
    console.error('Erro ao salvar financeiro:', err);
    res.status(500).json({ erro: 'Erro ao salvar financeiro' });
  }
});

// GET /financeiro-cliente/meta-padrao — busca meta padrão pelo mês de uso do cliente
router.get('/meta-padrao', autenticar, async (req, res) => {
  try {
    // Calcula há quantos meses o cliente está cadastrado
    const criadoEm = new Date(req.perfil.criado_em);
    const agora = new Date();
    const mesesDeUso = Math.floor((agora - criadoEm) / (1000 * 60 * 60 * 24 * 30)) + 1;

    const { data, error } = await supabaseAdmin
      .from('metas_padrao')
      .select('*')
      .eq('mes_de_uso', Math.min(mesesDeUso, 3)) // máx 3 no momento
      .single();

    if (error || !data) {
      // Retorna a última meta disponível se não encontrar
      const { data: ultima } = await supabaseAdmin
        .from('metas_padrao')
        .select('*')
        .order('mes_de_uso', { ascending: false })
        .limit(1)
        .single();
      return res.json({ meta: ultima?.valor || 8000, mes_de_uso: mesesDeUso });
    }

    res.json({ meta: data.valor, mes_de_uso: mesesDeUso });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar meta padrão' });
  }
});

// GET /financeiro-cliente/resumo — indicadores consolidados
router.get('/resumo', autenticar, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('financeiro_cliente')
      .select('*')
      .eq('cliente_id', req.perfil.id)
      .order('ano').order('mes');

    if (error) throw error;

    if (!data || data.length === 0) return res.json({ resumo: null });

    const melhorMes = data.reduce((a, b) => a.faturamento > b.faturamento ? a : b);
    const ultimo = data[data.length - 1];
    const penultimo = data.length > 1 ? data[data.length - 2] : null;
    const crescimento = penultimo && penultimo.faturamento > 0
      ? ((ultimo.faturamento - penultimo.faturamento) / penultimo.faturamento * 100).toFixed(1)
      : null;

    res.json({
      resumo: {
        melhorMes,
        ultimo,
        crescimento,
        metaAtingida: ultimo.meta ? ultimo.faturamento >= ultimo.meta : null,
        totalMeses: data.length
      }
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar resumo' });
  }
});

module.exports = router;
