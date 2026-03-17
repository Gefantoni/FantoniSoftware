// Rotas de Agentes IA Comercial — módulo comercial
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');
const { responderComAgente } = require('../services/agente-ia-comercial');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// GET /agentes — lista todos os agentes
router.get('/', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('agentes_ia_comercial')
      .select('*')
      .order('id');
    if (error) throw error;
    res.json({ agentes: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agentes' });
  }
});

// POST /agentes — cria novo agente
router.post('/', autenticar, adminOuComercial, async (req, res) => {
  const { nome, provider, prompt_sistema, tom_voz, objetivo, pode_agendar, pode_mover_kanban,
    pode_marcar_interesse, max_mensagens_dia, api_key } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });
  try {
    const { data, error } = await supabaseAdmin
      .from('agentes_ia_comercial')
      .insert({ nome, provider, prompt_sistema, tom_voz, objetivo, pode_agendar,
        pode_mover_kanban, pode_marcar_interesse, max_mensagens_dia, api_key })
      .select().single();
    if (error) {
      const logMsg = `[${new Date().toISOString()}] Erro criar agente: ${JSON.stringify(error)}\n`;
      fs.appendFileSync(path.join(__dirname, '../../../error.log'), logMsg);
      console.error('Erro ao criar agente:', error);
      return res.status(500).json({ erro: error.message || 'Erro ao criar agente' });
    }
    res.status(201).json({ agente: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

// GET /agentes/:id — busca um agente completo
router.get('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('agentes_ia_comercial')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ agente: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agente' });
  }
});

// PATCH /agentes/:id — atualiza configuração completa
router.patch('/:id', autenticar, adminOuComercial, async (req, res) => {
  const campos = { ...req.body, atualizado_em: new Date().toISOString() };
  try {
    const { data, error } = await supabaseAdmin
      .from('agentes_ia_comercial')
      .update(campos)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ agente: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar agente' });
  }
});

// DELETE /agentes/:id
router.delete('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('agentes_ia_comercial').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Agente removido' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover agente' });
  }
});

// POST /agentes/:id/testar — simula uma mensagem contra o agente
router.post('/:id/testar', autenticar, adminOuComercial, async (req, res) => {
  const { mensagem } = req.body;
  if (!mensagem) return res.status(400).json({ erro: 'mensagem obrigatória' });

  try {
    const { data: agente } = await supabaseAdmin
      .from('agentes_ia_comercial').select('*').eq('id', req.params.id).single();
    if (!agente) return res.status(404).json({ erro: 'Agente não encontrado' });

    const provider = agente.provider || 'openai';
    const apiKey = agente.api_key || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY);
    if (!apiKey) return res.status(400).json({ erro: `Chave de API não configurada para o provedor ${provider}` });

    const agenteComKey = { ...agente, api_key: apiKey };
    const resposta = await responderComAgente(agenteComKey, mensagem, []);

    const intencao = detectarIntencao(mensagem);
    const score = calcularScore(mensagem, intencao);

    res.json({
      resposta,
      intencao,
      score,
      acao_prevista: preverAcao(intencao, agente),
      tokens_usados: 0
    });
  } catch (err) {
    console.error('Erro ao testar agente:', err);
    res.status(500).json({ erro: 'Erro ao testar agente: ' + (err.message || 'desconhecido') });
  }
});


function detectarIntencao(mensagem) {
  const m = mensagem.toLowerCase();
  if (/(preço|valor|quanto|custo|investimento)/i.test(m)) return 'interesse_preco';
  if (/(problema|dificuldade|não consigo|preciso|ajuda)/i.test(m)) return 'dor';
  if (/(quero|gostaria|tenho interesse|me manda|me passa)/i.test(m)) return 'interesse_compra';
  if (/(reunião|conversar|agendar|marcar|ligar)/i.test(m)) return 'quero_reuniao';
  if (/(não|desistir|obrigado|tchau|dispensado)/i.test(m)) return 'desinteresse';
  return 'neutro';
}

function calcularScore(mensagem, intencao) {
  const scores = {
    interesse_compra: 85, quero_reuniao: 90, interesse_preco: 65,
    dor: 70, neutro: 30, desinteresse: 5
  };
  return scores[intencao] || 30;
}

function preverAcao(intencao, agente) {
  if (intencao === 'quero_reuniao' && agente.pode_agendar) return 'Agendar reunião';
  if (intencao === 'interesse_compra' && agente.pode_mover_kanban) return 'Mover para Kanban';
  if (intencao === 'dor' && agente.pode_marcar_interesse) return 'Marcar interesse detectado';
  if (intencao === 'desinteresse') return 'Pausar follow-up';
  return 'Continuar conversa';
}

module.exports = router;
