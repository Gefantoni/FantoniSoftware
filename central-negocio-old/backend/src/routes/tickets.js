// Rotas de tickets de suporte
const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuSuporte } = require('../middleware/roles');

const router = express.Router();

// GET /tickets — lista tickets (cliente: só os seus; admin/suporte: todos)
router.get('/', autenticar, async (req, res) => {
  try {
    let query = supabaseAdmin.from('tickets').select('*, perfis!tickets_cliente_id_fkey(nome, email)').order('criado_em', { ascending: false });

    if (req.perfil.role === 'cliente') {
      query = query.eq('cliente_id', req.perfil.id);
    }

    // Filtros opcionais (para admin)
    const { status, categoria, prioridade } = req.query;
    if (status)     query = query.eq('status', status);
    if (categoria)  query = query.eq('categoria', categoria);
    if (prioridade) query = query.eq('prioridade', prioridade);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ tickets: data });
  } catch (err) {
    console.error('Erro ao listar tickets:', err);
    res.status(500).json({ erro: 'Erro ao buscar tickets' });
  }
});

// POST /tickets — cliente abre um ticket
router.post('/',
  autenticar,
  body('titulo').notEmpty().withMessage('Título obrigatório'),
  body('categoria').isIn(['suporte', 'financeiro', 'comercial']),
  body('prioridade').optional().isIn(['baixa', 'normal', 'urgente']),
  body('descricao').notEmpty(),
  async (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ erros: erros.array() });

    const { titulo, categoria, prioridade, descricao } = req.body;
    try {
      // Cria o ticket
      const { data: ticket, error } = await supabaseAdmin
        .from('tickets')
        .insert({
          cliente_id: req.perfil.id,
          titulo, categoria,
          prioridade: prioridade || 'normal'
        })
        .select().single();

      if (error) throw error;

      // Adiciona a descrição como primeira mensagem
      await supabaseAdmin.from('mensagens_ticket').insert({
        ticket_id: ticket.id,
        autor_id: req.perfil.id,
        tipo: 'texto',
        conteudo: descricao
      });

      res.status(201).json({ mensagem: 'Ticket criado', ticket });
    } catch (err) {
      console.error('Erro ao criar ticket:', err);
      res.status(500).json({ erro: 'Erro ao criar ticket' });
    }
  }
);

// PATCH /tickets/:id/aceitar — admin/suporte aceita o ticket
router.patch('/:id/aceitar', autenticar, adminOuSuporte, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'aceito',
        atendente_id: req.perfil.id,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ mensagem: 'Ticket aceito', ticket: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao aceitar ticket' });
  }
});

// PATCH /tickets/:id/status — muda status do ticket
router.patch('/:id/status', autenticar, adminOuSuporte, async (req, res) => {
  const { status } = req.body;
  const statusValidos = ['aberto', 'aceito', 'em_andamento', 'resolvido'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    res.json({ ticket: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// GET /tickets/:id/mensagens — busca mensagens de um ticket
router.get('/:id/mensagens', autenticar, async (req, res) => {
  try {
    // Verifica se o cliente tem acesso ao ticket
    if (req.perfil.role === 'cliente') {
      const { data: ticket } = await supabaseAdmin
        .from('tickets').select('cliente_id').eq('id', req.params.id).single();
      if (!ticket || ticket.cliente_id !== req.perfil.id) {
        return res.status(403).json({ erro: 'Acesso negado' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('mensagens_ticket')
      .select('*, perfis(nome, role)')
      .eq('ticket_id', req.params.id)
      .order('criado_em');

    if (error) throw error;
    res.json({ mensagens: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

// POST /tickets/:id/mensagens — envia mensagem de texto
router.post('/:id/mensagens', autenticar, async (req, res) => {
  const { conteudo, tipo } = req.body;
  if (!conteudo) return res.status(400).json({ erro: 'Conteúdo obrigatório' });

  try {
    // Verifica se o cliente tem acesso ao ticket
    if (req.perfil.role === 'cliente') {
      const { data: ticket } = await supabaseAdmin
        .from('tickets').select('cliente_id').eq('id', req.params.id).single();
      if (!ticket || ticket.cliente_id !== req.perfil.id) {
        return res.status(403).json({ erro: 'Acesso negado' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('mensagens_ticket')
      .insert({
        ticket_id: parseInt(req.params.id),
        autor_id: req.perfil.id,
        tipo: tipo || 'texto',
        conteudo
      })
      .select('*, perfis(nome, role)')
      .single();

    if (error) throw error;

    // Atualiza timestamp do ticket
    await supabaseAdmin.from('tickets')
      .update({ atualizado_em: new Date().toISOString(), status: 'em_andamento' })
      .eq('id', req.params.id);

    res.status(201).json({ mensagem: data });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).json({ erro: 'Erro ao enviar mensagem' });
  }
});

module.exports = router;
