// Rotas de Relatórios Comerciais
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// GET /relatorios-comercial/leads — estatísticas de leads
router.get('/leads', autenticar, adminOuComercial, async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  try {
    let query = supabaseAdmin.from('leads').select('status, interesse_detectado, no_kanban, criado_em, instancia');
    if (data_inicio) query = query.gte('criado_em', data_inicio);
    if (data_fim) query = query.lte('criado_em', data_fim);

    const { data: leads, error } = await query;
    if (error) throw error;

    const total = leads.length;
    const por_status = agruparPor(leads, 'status');
    const contatados = leads.filter(l => l.status !== 'novo').length;
    const com_interesse = leads.filter(l => l.interesse_detectado).length;
    const no_kanban = leads.filter(l => l.no_kanban).length;
    const convertidos = leads.filter(l => l.status === 'convertido').length;
    const perdidos = leads.filter(l => l.status === 'perdido').length;
    const taxa_resposta = total > 0 ? ((contatados / total) * 100).toFixed(1) : 0;
    const taxa_interesse = total > 0 ? ((com_interesse / total) * 100).toFixed(1) : 0;

    // Por instância
    const por_instancia = {};
    leads.forEach(l => {
      const inst = l.instancia || 'sem_instancia';
      if (!por_instancia[inst]) por_instancia[inst] = { total: 0, interesse: 0, kanban: 0 };
      por_instancia[inst].total++;
      if (l.interesse_detectado) por_instancia[inst].interesse++;
      if (l.no_kanban) por_instancia[inst].kanban++;
    });

    res.json({ total, contatados, com_interesse, no_kanban, convertidos, perdidos,
              taxa_resposta, taxa_interesse, por_status, por_instancia });
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar relatório de leads' });
  }
});

// GET /relatorios-comercial/campanhas — desempenho por campanha
router.get('/campanhas', autenticar, adminOuComercial, async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  try {
    let query = supabaseAdmin.from('campanhas').select('*').neq('status', 'rascunho');
    if (data_inicio) query = query.gte('criado_em', data_inicio);
    if (data_fim) query = query.lte('criado_em', data_fim);

    const { data: campanhas, error } = await query;
    if (error) throw error;

    const totais = campanhas.reduce((acc, c) => {
      acc.enviados += c.total_enviados || 0;
      acc.respostas += c.total_respostas || 0;
      acc.interesse += c.total_interesse || 0;
      acc.oportunidades += c.total_oportunidades || 0;
      acc.reunioes += c.total_reunioes || 0;
      return acc;
    }, { enviados: 0, respostas: 0, interesse: 0, oportunidades: 0, reunioes: 0 });

    const taxa_resposta = totais.enviados > 0 ? ((totais.respostas / totais.enviados) * 100).toFixed(1) : 0;
    const taxa_interesse = totais.respostas > 0 ? ((totais.interesse / totais.respostas) * 100).toFixed(1) : 0;

    res.json({ campanhas, totais, taxa_resposta, taxa_interesse });
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar relatório de campanhas' });
  }
});

// GET /relatorios-comercial/ia — performance dos agentes IA
router.get('/ia', autenticar, adminOuComercial, async (req, res) => {
  const { data_inicio, data_fim } = req.query;
  try {
    let queryAts = supabaseAdmin.from('atividades_comercial').select('tipo, criado_em');
    if (data_inicio) queryAts = queryAts.gte('criado_em', data_inicio);
    if (data_fim) queryAts = queryAts.lte('criado_em', data_fim);

    const [{ data: atividades }, { data: convs }] = await Promise.all([
      queryAts,
      supabaseAdmin.from('sdr_conversas').select('criado_em').then(r => r)
    ]);

    const tipos = agruparPor(atividades || [], 'tipo');
    const conversas_ia = convs?.length || 0;
    const oportunidades_ia = (tipos['oportunidade_criada'] || []).length;
    const humano_assumiu = (tipos['humano_assumiu'] || []).length;
    const ia_desativada = (tipos['ia_desativada'] || []).length;
    const reunioes_ia = (tipos['reuniao_criada'] || []).filter(a => a.origem === 'ia').length;

    res.json({ conversas_ia, oportunidades_ia, humano_assumiu, ia_desativada, reunioes_ia,
              taxa_acerto: conversas_ia > 0 ? ((oportunidades_ia / conversas_ia) * 100).toFixed(1) : 0 });
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar relatório de IA' });
  }
});

// GET /relatorios-comercial/vendedor — performance do vendedor
router.get('/vendedor', autenticar, adminOuComercial, async (req, res) => {
  const { data_inicio, data_fim, vendedor_id } = req.query;
  try {
    let qr = supabaseAdmin.from('reunioes').select('status, vendedor_id, criado_em');
    let qo = supabaseAdmin.from('oportunidades').select('etapa, responsavel_id, criado_em, valor_estimado');
    if (data_inicio) { qr = qr.gte('criado_em', data_inicio); qo = qo.gte('criado_em', data_inicio); }
    if (data_fim) { qr = qr.lte('criado_em', data_fim); qo = qo.lte('criado_em', data_fim); }
    if (vendedor_id) { qr = qr.eq('vendedor_id', vendedor_id); qo = qo.eq('responsavel_id', vendedor_id); }

    const [{ data: reunioes }, { data: oportunidades }] = await Promise.all([qr, qo]);

    const r_agendadas = (reunioes || []).filter(r => r.status === 'agendada').length;
    const r_concluidas = (reunioes || []).filter(r => r.status === 'concluida').length;
    const r_canceladas = (reunioes || []).filter(r => r.status === 'cancelada').length;
    const op_fechadas = (oportunidades || []).filter(o => o.etapa === 'fechado').length;
    const op_perdidas = (oportunidades || []).filter(o => o.etapa === 'perdido').length;
    const valor_fechado = (oportunidades || [])
      .filter(o => o.etapa === 'fechado')
      .reduce((s, o) => s + (o.valor_estimado || 0), 0);

    res.json({ r_agendadas, r_concluidas, r_canceladas, op_fechadas, op_perdidas, valor_fechado,
              taxa_fechamento: (oportunidades || []).length > 0
                ? ((op_fechadas / (oportunidades || []).length) * 100).toFixed(1) : 0 });
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar relatório do vendedor' });
  }
});

// GET /relatorios-comercial/funil — dados do funil de conversão
router.get('/funil', autenticar, adminOuComercial, async (req, res) => {
  try {
    const [{ data: leads }, { data: ops }] = await Promise.all([
      supabaseAdmin.from('leads').select('status, interesse_detectado, no_kanban'),
      supabaseAdmin.from('oportunidades').select('etapa')
    ]);

    const total = (leads || []).length;
    const contatados = (leads || []).filter(l => l.status !== 'novo').length;
    const responderam = Math.round(contatados * 0.4); // estimativa sem rastrear individualmente
    const interesse = (leads || []).filter(l => l.interesse_detectado).length;
    const oportunidades = (leads || []).filter(l => l.no_kanban).length;
    const por_etapa = agruparPor(ops || [], 'etapa');
    const reuniao = (por_etapa['reuniao_agendada'] || []).length + (por_etapa['proposta'] || []).length + (por_etapa['negociacao'] || []).length + (por_etapa['fechado'] || []).length;
    const fechado = (por_etapa['fechado'] || []).length;

    res.json({
      funil: [
        { etapa: 'Importados', total },
        { etapa: 'Contatados', total: contatados },
        { etapa: 'Responderam', total: responderam },
        { etapa: 'Com interesse', total: interesse },
        { etapa: 'No Kanban', total: oportunidades },
        { etapa: 'Reunião', total: reuniao },
        { etapa: 'Fechados', total: fechado }
      ]
    });
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar funil' });
  }
});

// GET /relatorios-comercial/atividades — feed de atividades recentes
router.get('/atividades', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('atividades_comercial')
      .select('*, perfis(nome), leads(nome, empresa)')
      .order('criado_em', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ atividades: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar atividades' });
  }
});

function agruparPor(arr, campo) {
  return arr.reduce((acc, item) => {
    const k = item[campo] || 'indefinido';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

module.exports = router;
