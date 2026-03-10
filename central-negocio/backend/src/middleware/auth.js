// Middleware de autenticação — valida JWT do Supabase
const { supabaseAdmin } = require('../supabase');

async function autenticar(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];

    // Valida o token com o Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ erro: 'Token inválido ou expirado' });
    }

    // Busca o perfil completo do usuário (role, plano, etc.)
    const { data: perfil, error: erroPerfil } = await supabaseAdmin
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single();

    if (erroPerfil || !perfil) {
      return res.status(401).json({ erro: 'Perfil não encontrado' });
    }

    if (!perfil.ativo) {
      return res.status(403).json({ erro: 'Conta desativada' });
    }

    // Adiciona usuário e perfil ao request
    req.usuario = user;
    req.perfil = perfil;
    next();
  } catch (err) {
    console.error('Erro no middleware de auth:', err);
    res.status(500).json({ erro: 'Erro interno de autenticação' });
  }
}

module.exports = { autenticar };
