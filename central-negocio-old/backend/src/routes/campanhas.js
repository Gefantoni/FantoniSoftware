// Rotas de Campanhas — módulo comercial
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// GET /campanhas — lista todas com estatísticas
router.get('/', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campanhas')
      .select('*, agentes_ia_comercial(nome)')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ campanhas: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar campanhas' });
  }
});

// POST /campanhas — cria nova
router.post('/', autenticar, adminOuComercial, async (req, res) => {
  const { nome, descricao, instancia, agente_id, mensagem, tipo_fluxo, origem, tags } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome obrigatório' });
  try {
    const { data, error } = await supabaseAdmin
      .from('campanhas')
      .insert({ nome, descricao, instancia, agente_id, mensagem, tipo_fluxo, origem, tags })
      .select().single();
    if (error) throw error;
    res.status(201).json({ campanha: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao criar campanha' });
  }
});

// GET /campanhas/:id — detalhes + leads
router.get('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const [{ data: campanha, error: e1 }, { data: cl, error: e2 }] = await Promise.all([
      supabaseAdmin.from('campanhas').select('*, agentes_ia_comercial(nome,instancia)').eq('id', req.params.id).single(),
      supabaseAdmin.from('campanha_leads').select('*, leads(nome,empresa,whatsapp,cidade,segmento,status)').eq('campanha_id', req.params.id).order('id', { ascending: false })
    ]);
    if (e1) throw e1;
    res.json({ campanha, campanha_leads: cl || [] });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar campanha' });
  }
});

// PATCH /campanhas/:id — atualiza campos
router.patch('/:id', autenticar, adminOuComercial, async (req, res) => {
  const campos = req.body;
  campos.atualizado_em = new Date().toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from('campanhas').update(campos).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ campanha: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar campanha' });
  }
});

// DELETE /campanhas/:id
router.delete('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('campanhas').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Campanha removida' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover campanha' });
  }
});

// POST /campanhas/:id/leads — adiciona leads à campanha
router.post('/:id/leads', autenticar, adminOuComercial, async (req, res) => {
  const { lead_ids } = req.body;
  if (!lead_ids?.length) return res.status(400).json({ erro: 'lead_ids obrigatório' });
  try {
    const registros = lead_ids.map(lead_id => ({ campanha_id: Number(req.params.id), lead_id }));
    const { data, error } = await supabaseAdmin
      .from('campanha_leads').upsert(registros, { onConflict: 'campanha_id,lead_id' }).select();
    if (error) throw error;
    res.json({ adicionados: data.length });
  } catch {
    res.status(500).json({ erro: 'Erro ao adicionar leads' });
  }
});

// PATCH /campanhas/:id/leads/:leadId — atualiza status do lead na campanha
router.patch('/:id/leads/:leadId', autenticar, adminOuComercial, async (req, res) => {
  const { status } = req.body;
  try {
    const update = { status };
    if (status === 'enviado') update.enviado_em = new Date().toISOString();
    if (status === 'respondeu' || status === 'interesse') update.respondeu_em = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('campanha_leads')
      .update(update)
      .eq('campanha_id', req.params.id)
      .eq('lead_id', req.params.leadId)
      .select().single();
    if (error) throw error;
    res.json({ campanha_lead: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar lead na campanha' });
  }
});

// POST /campanhas/:id/pausar
router.post('/:id/pausar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campanhas').update({ status: 'pausada', atualizado_em: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ campanha: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao pausar campanha' });
  }
});

// POST /campanhas/:id/encerrar
router.post('/:id/encerrar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campanhas').update({ status: 'encerrada', atualizado_em: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ campanha: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao encerrar campanha' });
  }
});

// POST /campanhas/:id/ativar
router.post('/:id/ativar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campanhas').update({ status: 'ativa', atualizado_em: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ campanha: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao ativar campanha' });
  }
});

module.exports = router;
