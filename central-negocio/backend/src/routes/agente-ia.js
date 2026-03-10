// Rotas do Agente IA de suporte
const express = require('express');
const { autenticar } = require('../middleware/auth');
const { responderDuvida, buscarBaseConhecimento } = require('../services/openai');
const { supabaseAdmin } = require('../supabase');
const { apenasAdmin } = require('../middleware/roles');

const router = express.Router();

// POST /agente-ia/perguntar — cliente faz uma pergunta ao agente
router.post('/perguntar', autenticar, async (req, res) => {
  const { pergunta, historico } = req.body;
  if (!pergunta) return res.status(400).json({ erro: 'Pergunta obrigatória' });

  try {
    const resultado = await responderDuvida(pergunta, historico || []);
    res.json({
      resposta: resultado.resposta,
      videoRelacionado: resultado.videoRelacionado,
      fontes: resultado.fontes.map(f => ({ id: f.id, pergunta: f.pergunta }))
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ---- ADMIN: CRUD da base de conhecimento ----

// GET /agente-ia/base
router.get('/base', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('base_conhecimento')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    res.json({ base: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar base de conhecimento' });
  }
});

// POST /agente-ia/base
router.post('/base', autenticar, apenasAdmin, async (req, res) => {
  const { pergunta, resposta, url_video, tags } = req.body;
  if (!pergunta || !resposta) return res.status(400).json({ erro: 'Pergunta e resposta são obrigatórios' });

  try {
    const { data, error } = await supabaseAdmin
      .from('base_conhecimento')
      .insert({ pergunta, resposta, url_video, tags: tags || [] })
      .select().single();
    if (error) throw error;
    res.status(201).json({ item: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar item' });
  }
});

// PUT /agente-ia/base/:id
router.put('/base/:id', autenticar, apenasAdmin, async (req, res) => {
  const { pergunta, resposta, url_video, tags, ativo } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('base_conhecimento')
      .update({ pergunta, resposta, url_video, tags, ativo })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar item' });
  }
});

// DELETE /agente-ia/base/:id
router.delete('/base/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    await supabaseAdmin.from('base_conhecimento').delete().eq('id', req.params.id);
    res.json({ mensagem: 'Item removido' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover item' });
  }
});

module.exports = router;
