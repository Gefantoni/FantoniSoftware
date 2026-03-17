// Rotas de Reuniões / Calendário — módulo comercial
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// GET /reunioes — lista com filtros
router.get('/', autenticar, adminOuComercial, async (req, res) => {
  const { data_inicio, data_fim, vendedor_id, status } = req.query;
  try {
    let query = supabaseAdmin
      .from('reunioes')
      .select('*, leads(nome, empresa, whatsapp), oportunidades(titulo, etapa), perfis(nome)')
      .order('data_hora', { ascending: true });

    if (data_inicio) query = query.gte('data_hora', data_inicio);
    if (data_fim) query = query.lte('data_hora', data_fim);
    if (vendedor_id) query = query.eq('vendedor_id', vendedor_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ reunioes: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar reuniões' });
  }
});

// POST /reunioes — cria nova reunião
router.post('/', autenticar, adminOuComercial, async (req, res) => {
  const { lead_id, oportunidade_id, campanha_id, vendedor_id, titulo,
          data_hora, duracao_min, observacoes, origem } = req.body;
  if (!titulo || !data_hora) return res.status(400).json({ erro: 'titulo e data_hora obrigatórios' });

  try {
    const { data: reuniao, error } = await supabaseAdmin
      .from('reunioes')
      .insert({ lead_id, oportunidade_id, campanha_id,
                vendedor_id: vendedor_id || req.perfil.id,
                titulo, data_hora, duracao_min: duracao_min || 60,
                observacoes, origem: origem || 'manual' })
      .select().single();
    if (error) throw error;

    // Move oportunidade para "reuniao_agendada" automaticamente
    if (oportunidade_id) {
      await supabaseAdmin.from('oportunidades')
        .update({ etapa: 'reuniao_agendada', atualizado_em: new Date().toISOString() })
        .eq('id', oportunidade_id);

      await supabaseAdmin.from('oportunidades_movimentacoes').insert({
        oportunidade_id,
        etapa_nova: 'reuniao_agendada',
        observacao: `Reunião agendada: ${titulo}`,
        autor_id: req.perfil.id
      });
    }

    // Registra atividade
    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'reuniao_criada',
      descricao: `Reunião "${titulo}" agendada`,
      lead_id, oportunidade_id, campanha_id,
      reuniao_id: reuniao.id, autor_id: req.perfil.id
    });

    res.status(201).json({ reuniao });
  } catch {
    res.status(500).json({ erro: 'Erro ao criar reunião' });
  }
});

// GET /reunioes/:id
router.get('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reunioes')
      .select('*, leads(nome, empresa, whatsapp, cidade), oportunidades(titulo, etapa), perfis(nome)')
      .eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ reuniao: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar reunião' });
  }
});

// PATCH /reunioes/:id — atualiza (status, reagendamento, etc.)
router.patch('/:id', autenticar, adminOuComercial, async (req, res) => {
  const campos = { ...req.body, atualizado_em: new Date().toISOString() };
  try {
    const { data, error } = await supabaseAdmin
      .from('reunioes').update(campos).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Se concluída, registra atividade
    if (campos.status === 'concluida') {
      await supabaseAdmin.from('atividades_comercial').insert({
        tipo: 'reuniao_concluida',
        descricao: `Reunião "${data.titulo}" concluída`,
        lead_id: data.lead_id, oportunidade_id: data.oportunidade_id,
        reuniao_id: data.id, autor_id: req.perfil.id
      });
    }

    res.json({ reuniao: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar reunião' });
  }
});

// DELETE /reunioes/:id
router.delete('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('reunioes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Reunião removida' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover reunião' });
  }
});

module.exports = router;
