// Rotas de Agentes IA Comercial — módulo comercial
const express = require('express');
const multer  = require('multer');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');
const { responderComAgente } = require('../services/agente-ia-comercial');
const fs = require('fs');
const path = require('path');

// Multer para upload de mídias SDR (até 50 MB)
const uploadMidia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = [
      'video/mp4','video/webm','video/quicktime',
      'image/jpeg','image/png','image/webp','image/gif',
      'audio/ogg','audio/mp4','audio/webm','audio/mpeg','audio/wav'
    ];
    if (permitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
  }
});

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

// GET /agentes/sdr/config — deve vir ANTES de /:id para não conflitar
router.get('/sdr/config', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('agentes_ia_comercial')
      .select('*')
      .order('id')
      .limit(10);
    if (error) throw error;
    const agente = (data || []).find(a => a.nome?.toLowerCase().includes('lara'))
      || (data || []).find(a => a.system_prompt)
      || (data || [])[0]
      || null;
    res.json({ agente });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar config SDR: ' + err.message });
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

// ─── Rotas SDR — Mídias do Agente ─────────────────────────────────────────────

// GET /agentes/:id/midias — lista mídias configuradas para um agente
router.get('/:id/midias', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sdr_midias')
      .select('*')
      .eq('agente_id', req.params.id)
      .order('tag');
    if (error) throw error;
    res.json({ midias: data || [] });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar mídias: ' + err.message });
  }
});

// PUT /agentes/:id/midias/:tag — salva/atualiza config de uma tag de mídia
router.put('/:id/midias/:tag', autenticar, adminOuComercial, async (req, res) => {
  const { tipo, url, caption, filename, ativo } = req.body;
  const TAGS_VALIDAS = ['SEND_VIDEO_DEMO', 'SEND_FOTO_IMPRESSORA', 'SEND_AUDIO_PROVA', 'SEND_CARDAPIO_DEMO', 'SEND_LINK_TESTE'];
  if (!TAGS_VALIDAS.includes(req.params.tag)) {
    return res.status(400).json({ erro: 'Tag inválida' });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('sdr_midias')
      .upsert({
        agente_id: parseInt(req.params.id),
        tag: req.params.tag,
        tipo: tipo || 'link',
        url: url || null,
        caption: caption || null,
        filename: filename || null,
        ativo: ativo !== false,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'agente_id,tag' })
      .select().single();
    if (error) throw error;
    res.json({ midia: data });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar mídia: ' + err.message });
  }
});

// POST /agentes/:id/midias/:tag/upload — faz upload de arquivo e retorna URL pública no Supabase Storage
router.post('/:id/midias/:tag/upload', autenticar, adminOuComercial, uploadMidia.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const TAGS_VALIDAS = ['SEND_VIDEO_DEMO', 'SEND_FOTO_IMPRESSORA', 'SEND_AUDIO_PROVA', 'SEND_CARDAPIO_DEMO', 'SEND_LINK_TESTE'];
  if (!TAGS_VALIDAS.includes(req.params.tag)) {
    return res.status(400).json({ erro: 'Tag inválida' });
  }

  try {
    const ext  = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
    const nome = `sdr-midias/${req.params.id}/${req.params.tag}/${Date.now()}.${ext}`;

    const { error: storageError } = await supabaseAdmin.storage
      .from('chat-arquivos')
      .upload(nome, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (storageError) throw new Error('Erro no storage: ' + storageError.message);

    const { data: urlData } = supabaseAdmin.storage.from('chat-arquivos').getPublicUrl(nome);

    res.json({ url: urlData.publicUrl, mimetype: req.file.mimetype });
  } catch (err) {
    console.error('Erro upload mídia SDR:', err);
    res.status(500).json({ erro: err.message });
  }
});

// POST /agentes/:id/testar-chat — simula conversa com histórico (para simulador)
router.post('/:id/testar-chat', autenticar, adminOuComercial, async (req, res) => {
  const { mensagem, historico = [] } = req.body;
  if (!mensagem) return res.status(400).json({ erro: 'mensagem obrigatória' });

  try {
    const { data: agente } = await supabaseAdmin
      .from('agentes_ia_comercial').select('*').eq('id', req.params.id).single();
    if (!agente) return res.status(404).json({ erro: 'Agente não encontrado' });

    const apiKey = agente.api_key || (agente.provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY);
    if (!apiKey) return res.status(400).json({ erro: 'Chave de API não configurada' });

    const agenteComKey = { ...agente, api_key: apiKey };
    const mensagensHistorico = historico.map(h => ({ role: h.role, content: h.content }));
    const resposta = await responderComAgente(agenteComKey, mensagem, mensagensHistorico, {});

    // Detecta tags de mídia na resposta para mostrar no simulador
    const { extrairTagsMidia } = require('../services/whatsapp');
    const { textoLimpo, tags } = extrairTagsMidia(resposta);

    const intencao = detectarIntencao(mensagem);

    res.json({
      resposta,
      textoLimpo,
      tagsMidia: tags,
      intencao,
      score: calcularScore(mensagem, intencao)
    });
  } catch (err) {
    console.error('Erro ao simular chat:', err);
    res.status(500).json({ erro: 'Erro ao simular: ' + (err.message || 'desconhecido') });
  }
});

module.exports = router;
