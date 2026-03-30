// Rotas do módulo de disparos em massa (WhatsApp + Email)
const express = require('express');
const XLSX    = require('xlsx');
const { autenticar }       = require('../middleware/auth');
const { adminOuComercial } = require('../middleware/roles');
const { supabaseAdmin }    = require('../supabase');
const {
  pausarFila, pararFila, statusFila,
  gerarMensagemWA, gerarMensagemEmail, normalizarTelefone,
  processarContato, dentroDoHorario,
} = require('../services/disparos');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseXLSX(buffer) {
  const wb   = XLSX.read(buffer, { type: 'buffer' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows;
}

function filtrarContatos(rows) {
  return rows
    .filter(r => String(r.situacao || '').toUpperCase() === 'ATIVA')
    .map((r, i) => ({
      _id:                  String(i),
      nome_fantasia:        r.nome_fantasia        || r['Nome Fantasia']        || '',
      razao_social:         r.razao_social         || r['Razão Social']         || r['Razao Social'] || '',
      email:                r.email                || r['E-mail']               || r['Email']        || '',
      telefones:            r.telefones            || r['Telefone']             || r['Telefones']    || '',
      municipio:            r.municipio            || r['Município']            || r['Municipio']    || '',
      estado:               r.estado               || r['Estado']               || r['UF']           || '',
      atividades_principal: r.atividades_principal || r['Atividade Principal']  || r['Segmento']     || '',
      situacao:             r.situacao             || '',
      cnpj:                 r.cnpj                 || r['CNPJ']                 || '',
    }));
}

// ── POST /api/disparos/importar ───────────────────────────────────────────────
router.post('/importar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { arquivo_base64 } = req.body;
    if (!arquivo_base64) return res.status(400).json({ erro: 'Arquivo não enviado' });

    const buffer      = Buffer.from(arquivo_base64, 'base64');
    const rows        = parseXLSX(buffer);
    const todos       = filtrarContatos(rows);
    const comEmail    = todos.filter(c => c.email && c.email.includes('@'));
    const comTelefone = todos.filter(c => normalizarTelefone(c.telefones));
    const comAmbos    = todos.filter(c => c.email && c.email.includes('@') && normalizarTelefone(c.telefones));

    res.json({
      total:        todos.length,
      com_email:    comEmail.length,
      com_telefone: comTelefone.length,
      com_ambos:    comAmbos.length,
      preview:      todos.slice(0, 500),
    });
  } catch (err) {
    console.error('[Disparos] Erro ao importar:', err);
    res.status(500).json({ erro: err.message || 'Erro ao processar arquivo' });
  }
});

// ── POST /api/disparos/gerar-preview ─────────────────────────────────────────
// Gera 2 variações de mensagem WA para validar tom de voz
router.post('/gerar-preview', autenticar, adminOuComercial, async (req, res) => {
  const { contexto_ia, inspiracao_texto, lead } = req.body;
  const params = {
    nomeFantasia: lead?.nome     || 'Restaurante do João',
    razaoSocial:  lead?.nome     || 'Restaurante do João',
    municipio:    lead?.cidade   || 'Porto Alegre',
    estado:       lead?.estado   || 'RS',
    segmento:     lead?.segmento || 'restaurantes e lanchonetes',
  };
  try {
    const [v1, v2] = await Promise.all([
      gerarMensagemWA(params, contexto_ia, inspiracao_texto),
      gerarMensagemWA(params, contexto_ia, inspiracao_texto),
    ]);
    res.json({ variacoes: [v1, v2], lead_usado: params });
  } catch (err) {
    console.error('[Disparos] Erro ao gerar preview:', err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar preview com IA' });
  }
});

// ── POST /api/disparos/gerar-mensagem ─────────────────────────────────────────
// Gera prévia de mensagem WA e email para um lead
router.post('/gerar-mensagem', autenticar, adminOuComercial, async (req, res) => {
  const { nome_fantasia, razao_social, municipio, estado, atividades_principal, contexto_ia, inspiracao_texto } = req.body;
  try {
    const params = { nomeFantasia: nome_fantasia, razaoSocial: razao_social, municipio, estado, segmento: atividades_principal };
    const [msgWA, msgEmail] = await Promise.all([
      gerarMensagemWA(params, contexto_ia || null, inspiracao_texto || null),
      gerarMensagemEmail(params, contexto_ia || null, inspiracao_texto || null),
    ]);
    res.json({ whatsapp: msgWA, email: msgEmail });
  } catch (err) {
    console.error('[Disparos] Erro ao gerar mensagem:', err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar mensagem com IA' });
  }
});

// ── POST /api/disparos/iniciar ────────────────────────────────────────────────
router.post('/iniciar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const config = {
      canal:            req.body.canal           || 'whatsapp',
      instancias_ids:   req.body.instancias_ids  || [],
      intervaloMinSeg:  Number(req.body.intervalo_min) || 180,
      intervaloMaxSeg:  Number(req.body.intervalo_max) || 300,
      horaInicio:       req.body.hora_inicio     || null,
      horaFim:          req.body.hora_fim        || null,
      contextoIA:       req.body.contexto_ia     || null,
      inspiracaoTexto:  req.body.inspiracao_texto || null,
    };
    const nomeCampanha = req.body.nome           || null;
    const contatos     = req.body.contatos       || [];
    const iniciarAgora = req.body.iniciar_agora  !== false;

    if (!contatos.length) return res.status(400).json({ erro: 'Nenhum contato válido para disparo' });

    // Busca instâncias WhatsApp
    let instancias = [];
    if (config.instancias_ids.length > 0) {
      const { data } = await supabaseAdmin.from('instancias_whatsapp').select('*').in('id', config.instancias_ids).eq('status', 'ativo');
      instancias = data || [];
    } else {
      const { data } = await supabaseAdmin.from('instancias_whatsapp').select('*').eq('status', 'ativo');
      instancias = data || [];
    }

    // Cria campanha
    const { data: campanha, error } = await supabaseAdmin
      .from('disparos_campanhas')
      .insert({
        nome:          nomeCampanha,
        canal:         config.canal,
        total:         contatos.length,
        enviados:      0,
        erros:         0,
        status:        iniciarAgora ? 'ativo' : 'rascunho',
        config:        { ...config, contatos },
        criado_em:     new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Insere leads
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

    res.json({ campanha_id: campanha.id, total: contatos.length, status: iniciarAgora ? 'iniciado' : 'rascunho' });
  } catch (err) {
    console.error('[Disparos] Erro ao iniciar:', err);
    res.status(500).json({ erro: err.message || 'Erro ao iniciar disparo' });
  }
});

// ── GET /api/disparos/status/:id ──────────────────────────────────────────────
router.get('/status/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { id } = req.params;
    const emMemoria = statusFila(id);

    const { data: campanha } = await supabaseAdmin.from('disparos_campanhas').select('*').eq('id', id).single();
    const { data: leads }    = await supabaseAdmin
      .from('disparos_leads').select('*')
      .eq('campanha_id', id)
      .order('criado_em', { ascending: false })
      .limit(300);

    res.json({ campanha, leads: leads || [], em_execucao: !!emMemoria, fila: emMemoria });
  } catch (err) {
    res.status(500).json({ erro: err.message || 'Erro ao buscar status' });
  }
});

// ── GET /api/disparos — lista campanhas ───────────────────────────────────────
router.get('/', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('disparos_campanhas').select('*')
      .order('criado_em', { ascending: false })
      .limit(50);
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ erro: err.message || 'Erro interno' });
  }
});

// ── POST /api/disparos/:id/iniciar — inicia rascunho existente ────────────────
router.post('/:id/iniciar', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data: camp, error } = await supabaseAdmin.from('disparos_campanhas').select('*').eq('id', req.params.id).single();
    if (error || !camp) return res.status(404).json({ erro: 'Campanha não encontrada' });
    if (!['rascunho', 'pausado'].includes(camp.status)) {
      return res.status(400).json({ erro: `Campanha já está ${camp.status}` });
    }

    const contatos = (camp.config || {}).contatos || [];
    if (!contatos.length) return res.status(400).json({ erro: 'Sem contatos salvos nesta campanha' });

    await supabaseAdmin.from('disparos_campanhas')
      .update({ status: 'ativo', atualizado_em: new Date().toISOString() })
      .eq('id', req.params.id);

    res.json({ ok: true, status: 'iniciado', total: contatos.length });
    // Nota: o loop de envio é frontend-driven via POST /:id/step
  } catch (err) {
    console.error('[Disparos] Erro ao iniciar rascunho:', err.message);
    res.status(500).json({ erro: err.message || 'Erro ao iniciar campanha' });
  }
});

// ── POST /api/disparos/:id/step — processa um contato (frontend-driven) ───────
router.post('/:id/step', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: camp, error: campErr } = await supabaseAdmin.from('disparos_campanhas').select('*').eq('id', id).single();

    if (campErr || !camp) return res.status(404).json({ erro: 'Campanha não encontrada' });
    if (camp.status !== 'ativo') return res.json({ ok: false, motivo: `campanha_${camp.status}` });

    const config = camp.config || {};

    if (!dentroDoHorario(config.horaInicio, config.horaFim)) {
      return res.json({ ok: true, fora_horario: true, has_more: true });
    }

    // Próximo lead aguardando
    const { data: proxLeads } = await supabaseAdmin
      .from('disparos_leads').select('*')
      .eq('campanha_id', id).eq('status', 'aguardando')
      .order('criado_em', { ascending: true }).limit(1);

    const proxLead = proxLeads?.[0];
    if (!proxLead) {
      await supabaseAdmin.from('disparos_campanhas')
        .update({ status: 'concluido', atualizado_em: new Date().toISOString() }).eq('id', id);
      return res.json({ ok: true, has_more: false, concluido: true });
    }

    // Monta objeto contato
    const contatos = config.contatos || [];
    const contato  = contatos.find(c => String(c._id) === String(proxLead.lead_id)) || {
      _id:           proxLead.lead_id,
      nome_fantasia: proxLead.nome,
      razao_social:  proxLead.nome,
      email:         proxLead.email,
      telefones:     proxLead.telefone,
    };

    // Busca instâncias
    let instancias = [];
    if ((config.instancias_ids || []).length > 0) {
      const { data } = await supabaseAdmin.from('instancias_whatsapp').select('*').in('id', config.instancias_ids).eq('status', 'ativo');
      instancias = data || [];
    } else {
      const { data } = await supabaseAdmin.from('instancias_whatsapp').select('*').eq('status', 'ativo');
      instancias = data || [];
    }

    await processarContato(id, contato, config, instancias);
    // Incrementa contador de enviados diretamente (sem depender de RPC)
    const { data: campatual } = await supabaseAdmin
      .from('disparos_campanhas').select('enviados').eq('id', id).single();
    await supabaseAdmin.from('disparos_campanhas')
      .update({ enviados: (campatual?.enviados || 0) + 1, atualizado_em: new Date().toISOString() })
      .eq('id', id).catch(() => {});

    const { data: leadFinal } = await supabaseAdmin
      .from('disparos_leads').select('status')
      .eq('campanha_id', id).eq('lead_id', proxLead.lead_id).single();
    const enviouOk = leadFinal && !leadFinal.status.startsWith('erro');

    const { count } = await supabaseAdmin
      .from('disparos_leads').select('*', { count: 'exact', head: true })
      .eq('campanha_id', id).eq('status', 'aguardando');
    const hasMore = (count || 0) > 0;

    if (!hasMore) {
      await supabaseAdmin.from('disparos_campanhas')
        .update({ status: 'concluido', atualizado_em: new Date().toISOString() }).eq('id', id);
    }

    res.json({ ok: true, has_more: hasMore, nome: proxLead.nome, enviou_ok: enviouOk });
  } catch (err) {
    console.error('[Disparos] Erro no step:', err.message);
    res.status(500).json({ erro: err.message || 'Erro ao processar contato' });
  }
});

// ── POST /api/disparos/:id/pausar ─────────────────────────────────────────────
router.post('/:id/pausar', autenticar, adminOuComercial, async (req, res) => {
  pausarFila(req.params.id);
  await supabaseAdmin.from('disparos_campanhas').update({ status: 'pausado', atualizado_em: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok: true });
});

// ── POST /api/disparos/:id/retomar ────────────────────────────────────────────
router.post('/:id/retomar', autenticar, adminOuComercial, async (req, res) => {
  await supabaseAdmin.from('disparos_campanhas').update({ status: 'ativo', atualizado_em: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok: true });
});

// ── POST /api/disparos/:id/encerrar ──────────────────────────────────────────
router.post('/:id/encerrar', autenticar, adminOuComercial, async (req, res) => {
  pararFila(req.params.id);
  await supabaseAdmin.from('disparos_campanhas').update({ status: 'encerrado', atualizado_em: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok: true });
});

// ── PATCH /api/disparos/:id ────────────────────────────────────────────────────
router.patch('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { nome, canal, hora_inicio, hora_fim, intervalo_min, intervalo_max, contexto_ia, inspiracao_texto } = req.body;
    const campos = { atualizado_em: new Date().toISOString() };
    if (nome  !== undefined) campos.nome  = nome;
    if (canal !== undefined) campos.canal = canal;

    const configUpdate = {};
    if (hora_inicio     !== undefined) configUpdate.horaInicio      = hora_inicio;
    if (hora_fim        !== undefined) configUpdate.horaFim         = hora_fim;
    if (intervalo_min   !== undefined) configUpdate.intervaloMinSeg = Number(intervalo_min);
    if (intervalo_max   !== undefined) configUpdate.intervaloMaxSeg = Number(intervalo_max);
    if (contexto_ia     !== undefined) configUpdate.contextoIA      = contexto_ia;
    if (inspiracao_texto !== undefined) configUpdate.inspiracaoTexto = inspiracao_texto;

    if (Object.keys(configUpdate).length) {
      const { data: atual } = await supabaseAdmin.from('disparos_campanhas').select('config').eq('id', req.params.id).single();
      campos.config = { ...(atual?.config || {}), ...configUpdate };
    }

    const { data, error } = await supabaseAdmin.from('disparos_campanhas').update(campos).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ campanha: data });
  } catch (err) {
    console.error('[Disparos] Erro ao editar campanha:', err.message);
    res.status(500).json({ erro: err.message || 'Erro ao editar campanha' });
  }
});

// ── DELETE /api/disparos/:id ──────────────────────────────────────────────────
router.delete('/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    pararFila(req.params.id);
    const { error } = await supabaseAdmin.from('disparos_campanhas').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[Disparos] Erro ao excluir campanha:', err.message);
    res.status(500).json({ erro: err.message || 'Erro ao excluir campanha' });
  }
});

module.exports = router;
