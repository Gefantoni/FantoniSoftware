// Rotas de gestão de usuários (admin)
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { apenasAdmin } = require('../middleware/roles');

const router = express.Router();

const ROLES_VALIDOS = ['cliente', 'admin', 'suporte', 'financeiro', 'comercial'];
const PLANOS_VALIDOS = ['basico', 'profissional', 'premium'];

// GET /clientes — lista usuários (opcional: filtrar por role via ?role=cliente)
router.get('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('perfis')
      .select('id, nome, email, whatsapp, plano, role, ativo, permissoes_telas, criado_em')
      .order('criado_em', { ascending: false });

    if (req.query.role) {
      query = query.eq('role', req.query.role);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ clientes: data });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

// GET /clientes/:id — detalhes de um usuário
router.get('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { data: perfil, error } = await supabaseAdmin
      .from('perfis')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !perfil) return res.status(404).json({ erro: 'Usuário não encontrado' });

    // Para clientes, busca dados adicionais
    if (perfil.role === 'cliente') {
      const [{ data: progresso }, { data: tickets }, { data: financeiro }] = await Promise.all([
        supabaseAdmin.from('progresso').select('*, videoaulas(titulo)').eq('cliente_id', req.params.id),
        supabaseAdmin.from('tickets').select('*').eq('cliente_id', req.params.id).order('criado_em', { ascending: false }).limit(5),
        supabaseAdmin.from('financeiro_cliente').select('*').eq('cliente_id', req.params.id).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(6)
      ]);
      return res.json({ perfil, progresso, tickets, financeiro });
    }

    res.json({ perfil });
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /clientes — cadastra novo usuário (qualquer role)
router.post('/',
  autenticar, apenasAdmin,
  body('nome').notEmpty().withMessage('Nome obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').isLength({ min: 6 }).withMessage('Senha mínimo 6 caracteres'),
  body('role').isIn(ROLES_VALIDOS).withMessage('Role inválido'),
  async (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erros: erros.array() });

    const { nome, email, senha, whatsapp, plano, role } = req.body;

    // Plano é obrigatório apenas para clientes
    if (role === 'cliente' && plano && !PLANOS_VALIDOS.includes(plano)) {
      return res.status(400).json({ erro: 'Plano inválido' });
    }

    try {
      // Cria usuário no Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      });
      if (authError) return res.status(400).json({ erro: authError.message });

      const perfilDados = {
        id: authData.user.id,
        nome,
        email,
        whatsapp: whatsapp || null,
        role,
        plano: role === 'cliente' ? (plano || 'basico') : null,
        permissoes_telas: role === 'cliente' ? {
          videoaulas: true,
          agente_ia: true,
          cardapio_ia: true,
          financeiro: true,
          tickets: true,
          empreendedorismo: true
        } : null
      };

      const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('perfis')
        .upsert(perfilDados)
        .select()
        .single();

      if (perfilError) throw perfilError;
      res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso', perfil });
    } catch (err) {
      console.error('Erro ao cadastrar usuário:', err);
      res.status(500).json({ erro: 'Erro ao cadastrar usuário' });
    }
  }
);

// PUT /clientes/:id — edita usuário
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  const { nome, whatsapp, plano, ativo, role } = req.body;
  try {
    const campos = { nome, whatsapp, ativo };
    if (plano && PLANOS_VALIDOS.includes(plano)) campos.plano = plano;
    if (role && ROLES_VALIDOS.includes(role)) campos.role = role;

    const { data, error } = await supabaseAdmin
      .from('perfis')
      .update(campos)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ mensagem: 'Usuário atualizado', perfil: data });
  } catch (err) {
    console.error('Erro ao editar usuário:', err);
    res.status(500).json({ erro: 'Erro ao editar usuário' });
  }
});

// PATCH /clientes/:id/ativar — ativa ou desativa usuário
router.patch('/:id/ativar', autenticar, apenasAdmin, async (req, res) => {
  const { ativo } = req.body;
  try {
    await supabaseAdmin.from('perfis').update({ ativo }).eq('id', req.params.id);
    res.json({ mensagem: `Usuário ${ativo ? 'ativado' : 'desativado'}` });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao alterar status' });
  }
});

// PATCH /clientes/:id/permissoes — atualiza permissões de telas (apenas para clientes)
router.patch('/:id/permissoes', autenticar, apenasAdmin, async (req, res) => {
  const { permissoes_telas } = req.body;
  if (!permissoes_telas || typeof permissoes_telas !== 'object') {
    return res.status(400).json({ erro: 'permissoes_telas deve ser um objeto' });
  }

  // Garante que só telas válidas são salvas
  const telasValidas = ['videoaulas', 'agente_ia', 'cardapio_ia', 'financeiro', 'tickets', 'empreendedorismo'];
  const permissoesLimpas = {};
  for (const tela of telasValidas) {
    permissoesLimpas[tela] = permissoes_telas[tela] !== false;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('perfis')
      .update({ permissoes_telas: permissoesLimpas })
      .eq('id', req.params.id)
      .select('id, nome, permissoes_telas')
      .single();

    if (error) throw error;
    res.json({ mensagem: 'Permissões atualizadas', perfil: data });
  } catch (err) {
    console.error('Erro ao atualizar permissões:', err);
    res.status(500).json({ erro: 'Erro ao atualizar permissões' });
  }
});

module.exports = router;
