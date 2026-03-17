// Rotas de Oportunidades (Kanban) — módulo comercial
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// GET /oportunidades — lista todas para o Kanban
router.get('/', autenticar, adminOuComercial, async (req, res) => {
  const { etapa, responsavel_id } = req.query;
  try {
    let query = supabaseAdmin
      .from('oportunidades')
      .select(`
        *,
        leads(nome, empresa, whatsapp, cidade, segmento, origem, score, ultima_interacao),
        perfis(nome),
        campanhas(nome)
      `)
      .order('atualizado_em', { ascending: false });

    if (etapa) query = query.eq('etapa', etapa);
    if (responsavel_id) query = query.eq('responsavel_id', responsavel_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ oportunidades: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar oportunidades' });
  }
});

// POST /oportunidades — cria nova (quando lead entra no kanban)
router.post('/', autenticar, adminOuComercial, async (req, res) => {
  const { lead_id, titulo, etapa, temperatura, resumo_ia, proxima_acao,
          responsavel_id, campanha_id, motivo_qualificacao, valor_estimado, score } = req.body;

  if (!lead_id || !titulo) return res.status(400).json({ erro: 'lead_id e titulo obrigatórios' });

  try {
    // Cria a oportunidade
    const { data: op, error } = await supabaseAdmin
      .from('oportunidades')
      .insert({ lead_id, titulo, etapa: etapa || 'novo_interesse', temperatura,
                resumo_ia, proxima_acao, responsavel_id, campanha_id,
                motivo_qualificacao, valor_estimado, score })
      .select().single();
    if (error) throw error;

    // Marca o lead como no_kanban
    await supabaseAdmin.from('leads').update({ no_kanban: true, status: 'qualificado' }).eq('id', lead_id);

    // Registra movimentação inicial
    await supabaseAdmin.from('oportunidades_movimentacoes').insert({
      oportunidade_id: op.id,
      etapa_nova: op.etapa,
      observacao: motivo_qualificacao || 'Criado manualmente',
      autor_id: req.perfil.id
    });

    // Registra atividade
    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'oportunidade_criada',
      descricao: `Oportunidade "${titulo}" criada no Kanban`,
      lead_id, oportunidade_id: op.id, campanha_id, autor_id: req.perfil.id
    });

    res.status(201).json({ oportunidade: op });
  } catch {
    res.status(500).json({ erro: 'Erro ao criar oportunidade' });
  }
});

// GET /oportunidades/:id — detalhe completo
router.get('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const [{ data: op, error }, { data: movs }, { data: reunioes }] = await Promise.all([
      supabaseAdmin.from('oportunidades').select(`
        *, leads(*, perfis(nome)), perfis(nome), campanhas(nome)
      `).eq('id', req.params.id).single(),
      supabaseAdmin.from('oportunidades_movimentacoes')
        .select('*, perfis(nome)').eq('oportunidade_id', req.params.id).order('criado_em'),
      supabaseAdmin.from('reunioes')
        .select('*').eq('oportunidade_id', req.params.id).order('data_hora')
    ]);
    if (error) throw error;
    res.json({ oportunidade: op, movimentacoes: movs || [], reunioes: reunioes || [] });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar oportunidade' });
  }
});

// PATCH /oportunidades/:id — atualiza campos gerais
router.patch('/:id', autenticar, adminOuComercial, async (req, res) => {
  const campos = { ...req.body, atualizado_em: new Date().toISOString() };
  try {
    const { data, error } = await supabaseAdmin
      .from('oportunidades').update(campos).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ oportunidade: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar oportunidade' });
  }
});

// POST /oportunidades/:id/mover — move etapa no Kanban
router.post('/:id/mover', autenticar, adminOuComercial, async (req, res) => {
  const { etapa_nova, observacao } = req.body;
  if (!etapa_nova) return res.status(400).json({ erro: 'etapa_nova obrigatória' });

  try {
    // Busca etapa atual
    const { data: op } = await supabaseAdmin
      .from('oportunidades').select('etapa, lead_id').eq('id', req.params.id).single();

    // Atualiza etapa
    const { data: updated, error } = await supabaseAdmin
      .from('oportunidades')
      .update({ etapa: etapa_nova, atualizado_em: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;

    // Registra movimentação
    await supabaseAdmin.from('oportunidades_movimentacoes').insert({
      oportunidade_id: Number(req.params.id),
      etapa_anterior: op?.etapa,
      etapa_nova,
      observacao,
      autor_id: req.perfil.id
    });

    // Atualiza status do lead quando fecha/perde
    if (etapa_nova === 'fechado') {
      await supabaseAdmin.from('leads').update({ status: 'convertido' }).eq('id', op?.lead_id);
    } else if (etapa_nova === 'perdido') {
      await supabaseAdmin.from('leads').update({ status: 'perdido', no_kanban: false }).eq('id', op?.lead_id);
    }

    // Registra atividade
    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'kanban_movido',
      descricao: `Oportunidade movida para "${etapa_nova}"`,
      oportunidade_id: Number(req.params.id),
      lead_id: op?.lead_id,
      autor_id: req.perfil.id
    });

    res.json({ oportunidade: updated });
  } catch {
    res.status(500).json({ erro: 'Erro ao mover oportunidade' });
  }
});

// DELETE /oportunidades/:id
router.delete('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    // Desmarca no_kanban do lead
    const { data: op } = await supabaseAdmin
      .from('oportunidades').select('lead_id').eq('id', req.params.id).single();
    if (op?.lead_id) {
      await supabaseAdmin.from('leads').update({ no_kanban: false }).eq('id', op.lead_id);
    }
    const { error } = await supabaseAdmin.from('oportunidades').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Oportunidade removida' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover oportunidade' });
  }
});

module.exports = router;
