// Rotas do módulo comercial — leads e SDR
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// GET /comercial/leads — lista leads
router.get('/leads', autenticar, adminOuComercial, async (req, res) => {
  const { status } = req.query;
  try {
    let query = supabaseAdmin
      .from('leads')
      .select('*, perfis(nome)')
      .order('criado_em', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ leads: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar leads' });
  }
});

// POST /comercial/leads — cadastra lead manualmente
router.post('/leads', autenticar, adminOuComercial, async (req, res) => {
  const { nome, whatsapp, origem, notas } = req.body;
  if (!whatsapp) return res.status(400).json({ erro: 'whatsapp obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({ nome, whatsapp, origem, notas, responsavel_id: req.perfil.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ lead: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar lead' });
  }
});

// PATCH /comercial/leads/:id — atualiza status ou dados do lead
router.patch('/leads/:id', autenticar, adminOuComercial, async (req, res) => {
  const { status, nome, notas, responsavel_id } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ status, nome, notas, responsavel_id })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ lead: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar lead' });
  }
});

// GET /comercial/leads/:id/conversas — histórico SDR do lead
router.get('/leads/:id/conversas', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sdr_conversas')
      .select('*')
      .eq('lead_id', req.params.id)
      .order('criado_em');
    if (error) throw error;
    res.json({ conversas: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar conversas' });
  }
});

// GET /comercial/prompt-sdr — busca prompt do SDR
router.get('/prompt-sdr', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('base_conhecimento')
      .select('resposta')
      .eq('pergunta', '__SDR_PROMPT__')
      .single();

    res.json({ prompt: data?.resposta || '' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar prompt' });
  }
});

// PUT /comercial/prompt-sdr — atualiza prompt do SDR
router.put('/prompt-sdr', autenticar, adminOuComercial, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ erro: 'prompt obrigatório' });

  try {
    await supabaseAdmin
      .from('base_conhecimento')
      .upsert({ pergunta: '__SDR_PROMPT__', resposta: prompt, ativo: true }, { onConflict: 'pergunta' });

    res.json({ mensagem: 'Prompt atualizado' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar prompt' });
  }
});

module.exports = router;
