const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// ==========================================
// 1. DASHBOARD E RESUMO FINANCEIRO
// ==========================================
router.get('/dashboard', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesQuery = mes ? parseInt(mes) : new Date().getMonth() + 1;
  const anoQuery = ano ? parseInt(ano) : new Date().getFullYear();

  try {
    // Busca lançamentos do mês e ano específicos ou todos (se quiser DRE geral)
    // Para simplificar, trazemos tudo do mês requisitado
    const inicioMes = new Date(anoQuery, mesQuery - 1, 1).toISOString();
    const fimMes = new Date(anoQuery, mesQuery, 0, 23, 59, 59).toISOString();

    const { data: lancamentos, error } = await supabaseAdmin
      .from('fin_lancamentos')
      .select('valor, tipo, status')
      .eq('cliente_id', req.perfil.id)
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes);

    if (error) throw error;

    let faturamento = 0;
    let custos_pagos = 0;
    let custos_pendentes = 0;
    let receitas_pendentes = 0;

    lancamentos.forEach(l => {
      const valor = parseFloat(l.valor) || 0;
      if (l.tipo === 'receita') {
        if (l.status === 'pago') faturamento += valor;
        else receitas_pendentes += valor;
      } else if (l.tipo === 'despesa') {
        if (l.status === 'pago') custos_pagos += valor;
        else custos_pendentes += valor;
      }
    });

    res.json({
      resumo: {
        faturamento_realizado: faturamento,
        custos_pagos,
        lucro_liquido: faturamento - custos_pagos,
        a_receber: receitas_pendentes,
        a_pagar: custos_pendentes,
        saldo_projetado: faturamento - custos_pagos + receitas_pendentes - custos_pendentes
      }
    });
  } catch (err) {
    console.error('Erro ao buscar dashboard:', err);
    res.status(500).json({ erro: 'Erro ao gerar indicadores do dashboard' });
  }
});

// ==========================================
// 2. CONTAS BANCÁRIAS E CAIXA
// ==========================================
router.get('/contas', autenticar, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .select('*')
      .eq('cliente_id', req.perfil.id)
      .order('criado_em', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar contas bancárias' });
  }
});

router.post('/contas', autenticar, async (req, res) => {
  const { nome, saldo_inicial } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome da conta obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('fin_contas_bancarias')
      .insert([{ cliente_id: req.perfil.id, nome, saldo_inicial: parseFloat(saldo_inicial) || 0 }])
      .select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
});

// ==========================================
// 3. FUNCIONÁRIOS
// ==========================================
router.get('/funcionarios', autenticar, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('fin_funcionarios')
      .select('*')
      .eq('cliente_id', req.perfil.id)
      .order('nome', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar funcionários' });
  }
});

router.post('/funcionarios', autenticar, async (req, res) => {
  const { nome, cargo, salario_base } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('fin_funcionarios')
      .insert([{ cliente_id: req.perfil.id, nome, cargo, salario_base: parseFloat(salario_base) || 0 }])
      .select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar funcionário' });
  }
});

// ==========================================
// 4. LANÇAMENTOS (CONTAS P/R)
// ==========================================
router.get('/lancamentos', autenticar, async (req, res) => {
  const { mes, ano, tipo, status } = req.query;
  try {
    let query = supabaseAdmin
      .from('fin_lancamentos')
      .select(`
        *,
        fin_contas_bancarias (nome),
        fin_funcionarios (nome)
      `)
      .eq('cliente_id', req.perfil.id)
      .order('data_vencimento', { ascending: true });

    if (tipo) query = query.eq('tipo', tipo);
    if (status) query = query.eq('status', status);

    if (mes && ano) {
      const inicio = new Date(ano, mes - 1, 1).toISOString();
      const fim = new Date(ano, mes, 0, 23, 59, 59).toISOString();
      query = query.gte('data_vencimento', inicio).lte('data_vencimento', fim);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (err) {
    console.error('Erro buscar lançamentos:', err);
    res.status(500).json({ erro: 'Erro ao buscar lançamentos' });
  }
});

router.post('/lancamentos', autenticar, async (req, res) => {
  const { descricao, valor, tipo, data_vencimento, status, conta_bancaria_id, funcionario_id } = req.body;
  if (!descricao || !valor || !tipo || !data_vencimento) {
    return res.status(400).json({ erro: 'Campos obrigatórios: descricao, valor, tipo, data_vencimento' });
  }

  try {
    const data_pagamento = status === 'pago' ? new Date().toISOString() : null;
    
    // (Opcional) Logica para abater o saldo da 'conta_bancaria_id' pode ser inserida aqui
    // se formos atualizar o campo saldo_inicial da conta como um saldo corrente
    
    const { data, error } = await supabaseAdmin
      .from('fin_lancamentos')
      .insert([{
        cliente_id: req.perfil.id,
        descricao,
        valor: parseFloat(valor),
        tipo,
        data_vencimento,
        status: status || 'pendente',
        data_pagamento,
        conta_bancaria_id: conta_bancaria_id || null,
        funcionario_id: funcionario_id || null
      }])
      .select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar lançamento' });
  }
});

// MARCAR COMO PAGO (DAR BAIXA)
router.put('/lancamentos/:id/baixa', autenticar, async (req, res) => {
  const { id } = req.params;
  const { status, conta_bancaria_id } = req.body; // 'pago' ou 'pendente'
  
  try {
    const data_pagamento = status === 'pago' ? new Date().toISOString() : null;
    
    const updates = { status, data_pagamento };
    if(conta_bancaria_id) updates.conta_bancaria_id = conta_bancaria_id;

    const { data, error } = await supabaseAdmin
      .from('fin_lancamentos')
      .update(updates)
      .eq('id', id)
      .eq('cliente_id', req.perfil.id) // Segurança
      .select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao alterar status do lançamento' });
  }
});

// CANCELAR / EXCLUIR
router.delete('/lancamentos/:id', autenticar, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('fin_lancamentos')
      .delete()
      .eq('id', req.params.id)
      .eq('cliente_id', req.perfil.id); // Segurança

    if (error) throw error;
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir lançamento' });
  }
});

module.exports = router;
