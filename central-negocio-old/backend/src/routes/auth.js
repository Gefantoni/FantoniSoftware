// Rotas de autenticação
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// POST /auth/login
router.post('/login',
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha obrigatória'),
  async (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erros: erros.array() });

    const { email, senha } = req.body;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) return res.status(401).json({ erro: 'Email ou senha inválidos' });

      // Busca perfil para retornar role e plano
      const { data: perfil } = await supabaseAdmin
        .from('perfis')
        .select('*')
        .eq('id', data.user.id)
        .single();

      res.json({
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        usuario: {
          id: data.user.id,
          email: data.user.email,
          nome: perfil?.nome,
          role: perfil?.role,
          plano: perfil?.plano,
          permissoes_telas: perfil?.permissoes_telas ?? null
        }
      });
    } catch (err) {
      console.error('Erro no login:', err);
      res.status(500).json({ erro: 'Erro interno' });
    }
  }
);

// POST /auth/logout
router.post('/logout', autenticar, async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ mensagem: 'Logout realizado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao fazer logout' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ erro: 'refresh_token obrigatório' });

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ erro: 'Token expirado, faça login novamente' });

    res.json({ token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// GET /auth/perfil — retorna perfil do usuário logado
router.get('/perfil', autenticar, async (req, res) => {
  res.json({ perfil: req.perfil });
});

module.exports = router;
