// Rotas de videoaulas e módulos (cliente + admin)
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { apenasAdmin } = require('../middleware/roles');

const router = express.Router();

// Mapa de acesso por plano
const planosOrdem = { basico: 0, profissional: 1, premium: 2 };

// GET /videoaulas/modulos — lista módulos acessíveis pelo plano do cliente
router.get('/modulos', autenticar, async (req, res) => {
  try {
    const planoCliente = req.perfil.plano;
    const { data: modulos, error } = await supabaseAdmin
      .from('modulos')
      .select('*, videoaulas(*)')
      .eq('ativo', true)
      .order('ordem');

    if (error) throw error;

    // Filtra módulos pelo plano do cliente
    const modulosAcessiveis = modulos.filter(m =>
      planosOrdem[planoCliente] >= planosOrdem[m.plano_minimo]
    );

    res.json({ modulos: modulosAcessiveis });
  } catch (err) {
    console.error('Erro ao buscar módulos:', err);
    res.status(500).json({ erro: 'Erro ao buscar módulos' });
  }
});

// GET /videoaulas/progresso — progresso do cliente logado
router.get('/progresso', autenticar, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('progresso')
      .select('*, videoaulas(titulo, duracao_seg)')
      .eq('cliente_id', req.perfil.id);

    if (error) throw error;
    res.json({ progresso: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar progresso' });
  }
});

// POST /videoaulas/progresso — salva/atualiza progresso
router.post('/progresso', autenticar, async (req, res) => {
  const { videoaula_id, segundos_vistos, concluido } = req.body;
  if (!videoaula_id) return res.status(400).json({ erro: 'videoaula_id obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('progresso')
      .upsert({
        cliente_id: req.perfil.id,
        videoaula_id,
        segundos_vistos: segundos_vistos || 0,
        concluido: concluido || false,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'cliente_id,videoaula_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ progresso: data });
  } catch (err) {
    console.error('Erro ao salvar progresso:', err);
    res.status(500).json({ erro: 'Erro ao salvar progresso' });
  }
});

// ---- ADMIN: CRUD módulos ----

// GET /videoaulas/admin/modulos
router.get('/admin/modulos', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('modulos')
      .select('*, videoaulas(*)')
      .order('ordem');
    if (error) throw error;
    res.json({ modulos: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar módulos' });
  }
});

// POST /videoaulas/admin/modulos
router.post('/admin/modulos', autenticar, apenasAdmin, async (req, res) => {
  const { titulo, descricao, plano_minimo, ordem } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Título obrigatório' });

  try {
    const { data, error } = await supabaseAdmin
      .from('modulos')
      .insert({ titulo, descricao, plano_minimo: plano_minimo || 'basico', ordem: ordem || 0 })
      .select().single();
    if (error) throw error;
    res.status(201).json({ modulo: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar módulo' });
  }
});

// PUT /videoaulas/admin/modulos/:id
router.put('/admin/modulos/:id', autenticar, apenasAdmin, async (req, res) => {
  const { titulo, descricao, plano_minimo, ordem, ativo } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('modulos')
      .update({ titulo, descricao, plano_minimo, ordem, ativo })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ modulo: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar módulo' });
  }
});

// DELETE /videoaulas/admin/modulos/:id
router.delete('/admin/modulos/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    await supabaseAdmin.from('modulos').delete().eq('id', req.params.id);
    res.json({ mensagem: 'Módulo removido' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover módulo' });
  }
});

// POST /videoaulas/admin/aulas — cria aula dentro de módulo
router.post('/admin/aulas', autenticar, apenasAdmin, async (req, res) => {
  const { modulo_id, titulo, descricao, url_video, thumb_url, duracao_seg, ordem } = req.body;
  if (!modulo_id || !titulo || !url_video) {
    return res.status(400).json({ erro: 'modulo_id, titulo e url_video são obrigatórios' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('videoaulas')
      .insert({ modulo_id, titulo, descricao, url_video, thumb_url, duracao_seg, ordem })
      .select().single();
    if (error) throw error;
    res.status(201).json({ aula: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar aula' });
  }
});

// PUT /videoaulas/admin/aulas/:id
router.put('/admin/aulas/:id', autenticar, apenasAdmin, async (req, res) => {
  const { titulo, descricao, url_video, thumb_url, duracao_seg, ordem, ativo } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('videoaulas')
      .update({ titulo, descricao, url_video, thumb_url, duracao_seg, ordem, ativo })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ aula: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar aula' });
  }
});

// DELETE /videoaulas/admin/aulas/:id
router.delete('/admin/aulas/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    await supabaseAdmin.from('videoaulas').delete().eq('id', req.params.id);
    res.json({ mensagem: 'Aula removida' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover aula' });
  }
});

module.exports = router;
