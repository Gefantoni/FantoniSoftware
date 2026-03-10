// Rotas de gestão de clientes (admin)
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { apenasAdmin } = require('../middleware/roles');

const router = express.Router();

// GET /clientes — lista todos os clientes
router.get('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('perfis')
      .select('*')
      .eq('role', 'cliente')
      .order('criado_em', { ascending: false });

    if (error) throw error;
    res.json({ clientes: data });
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

// GET /clientes/:id — detalhes de um cliente
router.get('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { data: perfil, error } = await supabaseAdmin
      .from('perfis')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !perfil) return res.status(404).json({ erro: 'Cliente não encontrado' });

    // Busca progresso, tickets e financeiro junto
    const [{ data: progresso }, { data: tickets }, { data: financeiro }] = await Promise.all([
      supabaseAdmin.from('progresso').select('*, videoaulas(titulo)').eq('cliente_id', req.params.id),
      supabaseAdmin.from('tickets').select('*').eq('cliente_id', req.params.id).order('criado_em', { ascending: false }).limit(5),
      supabaseAdmin.from('financeiro_cliente').select('*').eq('cliente_id', req.params.id).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(6)
    ]);

    res.json({ perfil, progresso, tickets, financeiro });
  } catch (err) {
    console.error('Erro ao buscar cliente:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /clientes — cadastra novo cliente (cria usuário no Supabase Auth + perfil)
router.post('/',
  autenticar, apenasAdmin,
  body('nome').notEmpty(),
  body('email').isEmail(),
  body('senha').isLength({ min: 6 }),
  body('plano').isIn(['basico', 'profissional', 'premium']),
  async (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erros: erros.array() });

    const { nome, email, senha, whatsapp, plano } = req.body;
    try {
      // Cria usuário no Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      });
      if (authError) return res.status(400).json({ erro: authError.message });

      // Cria perfil na tabela perfis
      const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('perfis')
        .insert({ id: authData.user.id, nome, email, whatsapp, plano, role: 'cliente' })
        .select()
        .single();

      if (perfilError) throw perfilError;
      res.status(201).json({ mensagem: 'Cliente cadastrado com sucesso', perfil });
    } catch (err) {
      console.error('Erro ao cadastrar cliente:', err);
      res.status(500).json({ erro: 'Erro ao cadastrar cliente' });
    }
  }
);

// PUT /clientes/:id — edita cliente
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, whatsapp, plano, ativo } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('perfis')
      .update({ nome, whatsapp, plano, ativo })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ mensagem: 'Cliente atualizado', perfil: data });
  } catch (err) {
    console.error('Erro ao editar cliente:', err);
    res.status(500).json({ erro: 'Erro ao editar cliente' });
  }
});

// PATCH /clientes/:id/ativar — ativa ou desativa cliente
router.patch('/:id/ativar', autenticar, apenasAdmin, async (req, res) => {
  const { ativo } = req.body;
  try {
    await supabaseAdmin.from('perfis').update({ ativo }).eq('id', req.params.id);
    res.json({ mensagem: `Cliente ${ativo ? 'ativado' : 'desativado'}` });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao alterar status' });
  }
});

module.exports = router;
