// Rotas do módulo de disparos em massa (WhatsApp + Email)
const express  = require('express');
const multer   = require('multer');
const XLSX     = require('xlsx');
const { autenticar }      = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');
const { supabaseAdmin }   = require('../supabase');
const {
  iniciarFila, pausarFila, retomarFila, pararFila, statusFila,
  gerarMensagemWA, gerarMensagemEmail, normalizarTelefone,
} = require('../services/disparos');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────
function parseXLSX(buffer) {
  const wb    = XLSX.read(buffer, { type: 'buffer' });
  const ws    = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows;
}

function filtrarContatos(rows, { apenasAtiva = true, comEmail = false, comTelefone = false } = {}) {
  return rows
    .filter(r => !apenasAtiva || String(r.situacao || '').toUpperCase() === 'ATIVA')
    .filter(r => !comEmail    || (r.email && String(r.email).includes('@')))
    .filter(r => !comTelefone || normalizarTelefone(r.telefones))
    .map((r, i) => ({
      _id:                 String(i),
      nome_fantasia:       r.nome_fantasia       || '',
      razao_social:        r.razao_social        || '',
      email:               r.email               || '',
      telefones:           r.telefones           || '',
      municipio:           r.municipio           || '',
      estado:              r.estado              || '',
      atividades_principal: r.atividades_principal || '',
      situacao:            r.situacao            || '',
      cnpj:                r.cnpj                || '',
    }));
}

// ── POST /api/disparos/importar ───────────────────────────────
// Recebe arquivo .xlsx como base64 (compatível com Vercel serverless)
router.post('/importar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { arquivo_base64 } = req.body;
    if (!arquivo_base64) return res.status(400).json({ erro: 'Arquivo não enviado' });

    const buffer = Buffer.from(arquivo_base64, 'base64');
    const rows = parseXLSX(buffer);
    const todos = filtrarContatos(rows);
    const comEmail    = todos.filter(c => c.email && c.email.includes('@'));
    const comTelefone = todos.filter(c => normalizarTelefone(c.telefones));
    const comAmbos    = todos.filter(c => c.email && c.email.includes('@') && normalizarTelefone(c.telefones));

    // Retorna até 200 contatos na prévia para não explodir o payload
    res.json({
      total:        todos.length,
      com_email:    comEmail.length,
      com_telefone: comTelefone.length,
      com_ambos:    comAmbos.length,
      preview:      todos.slice(0, 200),
    });
  } catch (err) {
    console.error('[Disparos] Erro ao importar:', err);
    res.status(500).json({ erro: 'Erro ao processar arquivo' });
  }
});

// ── POST /api/disparos/gerar-mensagem ─────────────────────────
// Gera prévia de mensagem WA e email para um lead
router.post('/gerar-mensagem', autenticar, adminOuComercial, async (req, res) => {
  const { nome_fantasia, razao_social, municipio, estado, atividades_principal, prompt_wa, prompt_email } = req.body;
  try {
    const params = { nomeFantasia: nome_fantasia, razaoSocial: razao_social, municipio, estado, segmento: atividades_principal };
    const [msgWA, msgEmail] = await Promise.all([
      gerarMensagemWA(params, prompt_wa || null),
      gerarMensagemEmail(params, prompt_email || null),
    ]);
    res.json({ whatsapp: msgWA, email: msgEmail });
  } catch (err) {
    console.error('[Disparos] Erro ao gerar mensagem:', err);
    res.status(500).json({ erro: 'Erro ao gerar mensagem com IA' });
  }
});

// ── POST /api/disparos/iniciar ────────────────────────────────
// Inicia campanha de disparos com lista de contatos e configurações
router.post('/iniciar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const config = {
      canal:            req.body.canal          || 'ambos',
      instancias_ids:   req.body.instancias_ids || [],
      intervaloMinSeg:  Number(req.body.intervalo_min) || 60,
      intervaloMaxSeg:  Number(req.body.intervalo_max) || 120,
      horaInicio:       req.body.hora_inicio    || null,
      horaFim:          req.body.hora_fim       || null,
      promptWA:         req.body.prompt_wa      || null,
      promptEmail:      req.body.prompt_email   || null,
    };
    const nomeCampanha = req.body.nome || null;

    const contatos = req.body.contatos || [];

    if (!contatos.length) return res.status(400).json({ erro: 'Nenhum contato válido para disparo' });

    // Busca instâncias WhatsApp cadastradas
    let instancias = [];
    if (config.instancias_ids.length > 0) {
      const { data } = await supabaseAdmin
        .from('instancias_whatsapp')
        .select('*')
        .in('id', config.instancias_ids)
        .eq('ativo', true);
      instancias = data || [];
    } else {
      // Usa todas as ativas se nenhuma selecionada
      const { data } = await supabaseAdmin
        .from('instancias_whatsapp')
        .select('*')
        .eq('ativo', true);
      instancias = data || [];
    }

    // Cria registro da campanha no Supabase
    const { data: campanha, error } = await supabaseAdmin
      .from('disparos_campanhas')
      .insert({
        nome:               nomeCampanha,
        canal:              config.canal,
        total:              contatos.length,
        enviados:           0,
        erros:              0,
        status:             'ativo',
        config:             config,
        criado_em:          new Date().toISOString(),
        atualizado_em:      new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Insere leads da campanha
    const leadsRows = contatos.map(c => ({
      campanha_id: campanha.id,
      lead_id:     c._id,
      nome:        c.nome_fantasia || c.razao_social,
      email:       c.email,
      telefone:    normalizarTelefone(c.telefones),
      status:      'aguardando',
      criado_em:   new Date().toISOString(),
    }));
    await supabaseAdmin.from('disparos_leads').insert(leadsRows).then(() => {});

    // Inicia a fila (não bloqueia a resposta)
    iniciarFila(campanha.id, contatos, config, instancias).catch(console.error);

    res.json({ campanha_id: campanha.id, total: contatos.length, status: 'iniciado' });
  } catch (err) {
    console.error('[Disparos] Erro ao iniciar:', err);
    res.status(500).json({ erro: 'Erro ao iniciar disparo' });
  }
});

// ── GET /api/disparos/status/:id ──────────────────────────────
router.get('/status/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { id } = req.params;
    const emMemoria = statusFila(id);

    const { data: campanha } = await supabaseAdmin
      .from('disparos_campanhas')
      .select('*')
      .eq('id', id)
      .single();

    const { data: leads } = await supabaseAdmin
      .from('disparos_leads')
      .select('*')
      .eq('campanha_id', id)
      .order('criado_em', { ascending: false })
      .limit(200);

    res.json({
      campanha,
      leads:      leads || [],
      em_execucao: !!emMemoria,
      fila:       emMemoria,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar status' });
  }
});

// ── GET /api/disparos — lista campanhas ───────────────────────
router.get('/', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('disparos_campanhas')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ── POST /api/disparos/:id/pausar ─────────────────────────────
router.post('/:id/pausar', autenticar, adminOuComercial, async (req, res) => {
  const ok = pausarFila(req.params.id);
  if (ok) await supabaseAdmin.from('disparos_campanhas').update({ status: 'pausado', atualizado_em: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok });
});

// ── POST /api/disparos/:id/retomar ────────────────────────────
router.post('/:id/retomar', autenticar, adminOuComercial, async (req, res) => {
  const ok = retomarFila(req.params.id);
  if (ok) await supabaseAdmin.from('disparos_campanhas').update({ status: 'ativo', atualizado_em: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok });
});

// ── POST /api/disparos/:id/encerrar ──────────────────────────
router.post('/:id/encerrar', autenticar, adminOuComercial, async (req, res) => {
  pararFila(req.params.id);
  await supabaseAdmin.from('disparos_campanhas').update({ status: 'encerrado', atualizado_em: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
