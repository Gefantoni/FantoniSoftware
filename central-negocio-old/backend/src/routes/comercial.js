// Rotas do módulo comercial — leads, SDR, importação, instâncias
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { autenticar } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { adminOuComercial } = require('../middleware/roles');

const router = express.Router();

// ============================================================
// LEADS
// ============================================================

// GET /comercial/leads — lista com filtros avançados
router.get('/leads', autenticar, adminOuComercial, async (req, res) => {
  const { status, campanha_id, cidade, segmento, origem, com_interesse,
          no_kanban, sem_resposta, arquivado, busca } = req.query;
  const limit  = Math.min(Number(req.query.limit)  || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0,   0);
  try {
    let query = supabaseAdmin
      .from('leads')
      .select('*, perfis(nome)')
      .order('criado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status)        query = query.eq('status', status);
    if (campanha_id)   query = query.eq('campanha_id', campanha_id);
    if (cidade)        query = query.ilike('cidade', `%${cidade}%`);
    if (segmento)      query = query.eq('segmento', segmento);
    if (origem)        query = query.ilike('origem', `%${origem}%`);
    if (com_interesse === 'true')  query = query.eq('interesse_detectado', true);
    if (com_interesse === 'false') query = query.eq('interesse_detectado', false);
    if (no_kanban === 'true')  query = query.eq('no_kanban', true);
    if (no_kanban === 'false') query = query.eq('no_kanban', false);
    if (arquivado === 'true')  query = query.eq('arquivado', true);
    else query = query.eq('arquivado', false);
    if (busca) query = query.or(`nome.ilike.%${busca}%,empresa.ilike.%${busca}%,whatsapp.ilike.%${busca}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ leads: data, total: count });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar leads' });
  }
});

// POST /comercial/leads — cadastra lead manualmente
router.post('/leads', autenticar, adminOuComercial, async (req, res) => {
  const { nome, empresa, whatsapp, telefone, origem, cidade, segmento, notas, instancia } = req.body;
  if (!whatsapp) return res.status(400).json({ erro: 'whatsapp obrigatório' });
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({ nome, empresa, whatsapp, telefone, origem, cidade, segmento,
                notas, instancia, responsavel_id: req.perfil.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ lead: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao cadastrar lead' });
  }
});

// POST /comercial/leads/importar — importação em massa (CSV já processado no frontend)
router.post('/leads/importar', autenticar, adminOuComercial, async (req, res) => {
  const { leads, campanha_id, origem, tags, ignorar_duplicados = true } = req.body;
  if (!leads?.length) return res.status(400).json({ erro: 'lista de leads obrigatória' });

  const resultados = { importados: 0, duplicados: 0, invalidos: 0, erros: [] };

  // Valida e prepara registros
  const registros = [];
  for (const lead of leads) {
    if (!lead.whatsapp && !lead.telefone) { resultados.invalidos++; continue; }
    const tel = (lead.whatsapp || lead.telefone).replace(/\D/g, '');
    if (!tel) { resultados.invalidos++; continue; }
    registros.push({
      nome: lead.nome || null,
      empresa: lead.empresa || null,
      whatsapp: tel,
      telefone: lead.telefone || tel,
      cidade: lead.cidade || null,
      segmento: lead.segmento || null,
      observacoes: lead.observacoes || null,
      origem: lead.origem || origem || 'importacao',
      tags: tags || [],
      campanha_id: campanha_id || null,
      responsavel_id: req.perfil.id
    });
  }

  if (registros.length === 0) {
    return res.status(400).json({ erro: 'Nenhum lead válido na lista', resultados });
  }

  try {
    if (ignorar_duplicados) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .upsert(registros, { onConflict: 'whatsapp', ignoreDuplicates: true })
        .select();
      if (error) throw error;
      resultados.importados = data.length;
      resultados.duplicados = registros.length - data.length;
    } else {
      // Atualiza dados faltantes em leads existentes
      for (const reg of registros) {
        const { data: existente } = await supabaseAdmin
          .from('leads').select('id').eq('whatsapp', reg.whatsapp).single();
        if (existente) {
          // Atualiza apenas campos vazios
          const update = {};
          if (!existente.nome && reg.nome) update.nome = reg.nome;
          if (!existente.empresa && reg.empresa) update.empresa = reg.empresa;
          if (!existente.cidade && reg.cidade) update.cidade = reg.cidade;
          if (!existente.segmento && reg.segmento) update.segmento = reg.segmento;
          if (Object.keys(update).length) {
            await supabaseAdmin.from('leads').update(update).eq('id', existente.id);
          }
          resultados.duplicados++;
        } else {
          const { error } = await supabaseAdmin.from('leads').insert(reg);
          if (error) resultados.erros.push(reg.whatsapp);
          else resultados.importados++;
        }
      }
    }

    res.json({ resultados });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao importar leads', resultados });
  }
});

// PATCH /comercial/leads/:id — atualiza dados do lead
router.patch('/leads/:id', autenticar, adminOuComercial, async (req, res) => {
  const CAMPOS_PERMITIDOS = ['nome','empresa','whatsapp','telefone','origem','cidade','segmento',
    'notas','observacoes','status','no_kanban','kanban_etapa','tags','score','arquivado',
    'responsavel_id','interesse_detectado','ia_ativa','instancia','campanha_id'];
  const campos = { ultima_interacao: new Date().toISOString() };
  for (const campo of CAMPOS_PERMITIDOS) {
    if (req.body[campo] !== undefined) campos[campo] = req.body[campo];
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(campos)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ lead: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar lead' });
  }
});

// GET /comercial/leads/:id — detalhes completos do lead
router.get('/leads/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const [{ data: lead, error }, { data: conversas }, { data: campanhas }, { data: reunioes }, { data: oportunidade }] = await Promise.all([
      supabaseAdmin.from('leads').select('*, perfis(nome)').eq('id', req.params.id).single(),
      supabaseAdmin.from('sdr_conversas').select('*').eq('lead_id', req.params.id).order('criado_em'),
      supabaseAdmin.from('campanha_leads').select('*, campanhas(nome, status)').eq('lead_id', req.params.id),
      supabaseAdmin.from('reunioes').select('*').eq('lead_id', req.params.id).order('data_hora'),
      supabaseAdmin.from('oportunidades').select('*').eq('lead_id', req.params.id).maybeSingle()
    ]);
    if (error) throw error;
    res.json({ lead, conversas: conversas || [], campanhas: campanhas || [], reunioes: reunioes || [], oportunidade });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar lead' });
  }
});

// GET /comercial/leads/:id/conversas — histórico SDR
router.get('/leads/:id/conversas', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sdr_conversas')
      .select('*')
      .eq('lead_id', req.params.id)
      .order('criado_em');
    if (error) throw error;
    res.json({ conversas: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar conversas' });
  }
});

// POST /comercial/leads/bulk — operações em massa
router.post('/leads/bulk', autenticar, adminOuComercial, async (req, res) => {
  const { lead_ids, acao, valor } = req.body;
  if (!lead_ids?.length || !acao) return res.status(400).json({ erro: 'lead_ids e acao obrigatórios' });

  try {
    let update = {};
    if (acao === 'responsavel') update.responsavel_id = valor;
    else if (acao === 'status')   update.status = valor;
    else if (acao === 'arquivar') update.arquivado = true;
    else if (acao === 'desarquivar') update.arquivado = false;
    else if (acao === 'campanha') {
      // Vincula leads à campanha
      const registros = lead_ids.map(id => ({ campanha_id: Number(valor), lead_id: id }));
      await supabaseAdmin.from('campanha_leads').upsert(registros, { onConflict: 'campanha_id,lead_id', ignoreDuplicates: true });
      return res.json({ mensagem: `${lead_ids.length} leads vinculados à campanha` });
    } else return res.status(400).json({ erro: 'ação inválida' });

    const { error } = await supabaseAdmin.from('leads').update(update).in('id', lead_ids);
    if (error) throw error;
    res.json({ mensagem: `${lead_ids.length} leads atualizados` });
  } catch {
    res.status(500).json({ erro: 'Erro na operação em massa' });
  }
});

// GET /comercial/chatwoot-config — expõe URL pública do Chatwoot para o frontend
router.get('/chatwoot-config', autenticar, adminOuComercial, (req, res) => {
  res.json({
    url:       process.env.CHATWOOT_URL       || null,
    accountId: process.env.CHATWOOT_ACCOUNT_ID || '1'
  });
});

// ============================================================
// SDR (PROMPT)
// ============================================================

router.get('/prompt-sdr', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('base_conhecimento')
      .select('resposta')
      .eq('pergunta', '__SDR_PROMPT__')
      .single();
    res.json({ prompt: data?.resposta || '' });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar prompt' });
  }
});

router.put('/prompt-sdr', autenticar, adminOuComercial, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ erro: 'prompt obrigatório' });
  try {
    await supabaseAdmin
      .from('base_conhecimento')
      .upsert({ pergunta: '__SDR_PROMPT__', resposta: prompt, ativo: true }, { onConflict: 'pergunta' });
    res.json({ mensagem: 'Prompt atualizado' });
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar prompt' });
  }
});

// ============================================================
// INSTÂNCIAS WHATSAPP
// ============================================================

router.get('/instancias', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('instancias_whatsapp')
      .select('*, agentes_ia_comercial(nome)')
      .order('id');
    if (error) throw error;
    res.json({ instancias: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar instâncias' });
  }
});

router.post('/instancias', autenticar, adminOuComercial, async (req, res) => {
  const { nome, instancia_evo, api_url, apikey, descricao, agente_id, numero } = req.body;
  if (!nome || !instancia_evo) return res.status(400).json({ erro: 'nome e instancia_evo são obrigatórios' });
  const body = { nome, instancia_evo, api_url, apikey, descricao, agente_id: agente_id || null, numero };
  try {
    const { data, error } = await supabaseAdmin
      .from('instancias_whatsapp')
      .insert(body)
      .select().single();
    if (error) {
      console.error('Erro ao criar instância:', error.message);
      return res.status(500).json({ erro: 'Erro ao criar instância' });
    }
    res.status(201).json({ instancia: data });
  } catch (err) {
    console.error('Erro ao criar instância:', err.message);
    res.status(500).json({ erro: 'Erro ao criar instância' });
  }
});

router.patch('/instancias/:id', autenticar, adminOuComercial, async (req, res) => {
  const { nome, instancia_evo, api_url, apikey, descricao, agente_id, status, numero } = req.body;
  const campos = {};
  if (nome !== undefined)         campos.nome = nome;
  if (instancia_evo !== undefined) campos.instancia_evo = instancia_evo;
  if (api_url !== undefined)       campos.api_url = api_url;
  if (apikey !== undefined)        campos.apikey = apikey;
  if (descricao !== undefined)     campos.descricao = descricao;
  if (agente_id !== undefined)     campos.agente_id = agente_id || null;
  if (status !== undefined)        campos.status = status;
  if (numero !== undefined)        campos.numero = numero;
  try {
    const { data, error } = await supabaseAdmin
      .from('instancias_whatsapp')
      .update(campos)
      .eq('id', req.params.id)
      .select().single();
    if (error) {
      console.error('Erro ao atualizar instância:', error.message);
      return res.status(500).json({ erro: 'Erro ao atualizar instância' });
    }
    res.json({ instancia: data });
  } catch (err) {
    console.error('Erro ao atualizar instância:', err.message);
    res.status(500).json({ erro: 'Erro ao atualizar instância' });
  }
});

router.delete('/instancias/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('instancias_whatsapp')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Instância removida' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover instância' });
  }
});

// GET /comercial/instancias/:id/status — verifica conexão na Evolution API
router.get('/instancias/:id/status', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data: inst, error } = await supabaseAdmin
      .from('instancias_whatsapp').select('*').eq('id', req.params.id).single();
    if (error || !inst) return res.status(404).json({ erro: 'Instância não encontrada' });

    const baseUrl    = inst.api_url  || process.env.EVOLUTION_API_URL;
    const apiKey     = inst.apikey   || process.env.EVOLUTION_API_KEY;
    const instNome   = inst.instancia_evo || inst.nome_instancia;

    if (!baseUrl || !apiKey || !instNome) {
      return res.status(400).json({ erro: 'Instância sem URL, API Key ou nome configurados' });
    }

    const axios = require('axios');
    const resposta = await axios.get(`${baseUrl}/instance/connectionState/${instNome}`, {
      headers: { apikey: apiKey },
      timeout: 8000,
    });

    const state = resposta.data?.instance?.state || resposta.data?.state || 'unknown';
    res.json({
      instancia: inst.nome,
      nome_evo:  instNome,
      state,
      conectado: state === 'open',
      raw:       resposta.data,
    });
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Erro ao verificar conexão';
    res.status(502).json({ erro: msg, conectado: false });
  }
});

// POST /comercial/instancias/:id/testar — envia mensagem de teste
router.post('/instancias/:id/testar', autenticar, adminOuComercial, async (req, res) => {
  const { numero, mensagem } = req.body;
  if (!numero) return res.status(400).json({ erro: 'Número de destino obrigatório' });

  try {
    const { data: inst, error } = await supabaseAdmin
      .from('instancias_whatsapp').select('*').eq('id', req.params.id).single();
    if (error || !inst) return res.status(404).json({ erro: 'Instância não encontrada' });

    const baseUrl  = inst.api_url  || process.env.EVOLUTION_API_URL;
    const apiKey   = inst.apikey   || process.env.EVOLUTION_API_KEY;
    const instNome = inst.instancia_evo || inst.nome_instancia;

    if (!baseUrl || !apiKey || !instNome) {
      return res.status(400).json({ erro: 'Instância sem URL, API Key ou nome configurados' });
    }

    // Normaliza o número
    const numeros  = numero.replace(/\D/g, '');
    const numFinal = numeros.startsWith('55') && numeros.length >= 12
      ? numeros
      : '55' + numeros;

    const texto = mensagem?.trim() ||
      `✅ Mensagem de teste — Fantoni Software\nInstância: ${inst.nome}\nHorário: ${new Date().toLocaleString('pt-BR')}`;

    const axios = require('axios');
    const resposta = await axios.post(
      `${baseUrl}/message/sendText/${instNome}`,
      { number: numFinal, text: texto },
      { headers: { apikey: apiKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );

    res.json({ ok: true, numero: numFinal, mensagem: texto, raw: resposta.data });
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Erro ao enviar mensagem';
    res.status(502).json({ erro: msg, ok: false });
  }
});

// ============================================================
// TAGS COMERCIAIS
// ============================================================

router.get('/tags', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('tags_comercial').select('*').order('nome');
    if (error) throw error;
    res.json({ tags: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar tags' });
  }
});

router.post('/tags', autenticar, adminOuComercial, async (req, res) => {
  const { nome, cor } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome obrigatório' });
  try {
    const { data, error } = await supabaseAdmin
      .from('tags_comercial').insert({ nome, cor }).select().single();
    if (error) throw error;
    res.status(201).json({ tag: data });
  } catch {
    res.status(500).json({ erro: 'Erro ao criar tag' });
  }
});

router.delete('/tags/:id', autenticar, adminOuComercial, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('tags_comercial').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ mensagem: 'Tag removida' });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover tag' });
  }
});

// ============================================================
// DASHBOARD COMERCIAL
// ============================================================

router.get('/dashboard', autenticar, adminOuComercial, async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeIso = hoje.toISOString();

    const [
      { data: leads }, { data: ops }, { data: reunioes },
      { data: instancias }, { data: atividades }
    ] = await Promise.all([
      supabaseAdmin.from('leads').select('status, interesse_detectado, no_kanban, ultima_interacao, criado_em'),
      supabaseAdmin.from('oportunidades').select('etapa, criado_em'),
      supabaseAdmin.from('reunioes').select('status, data_hora, titulo, leads(nome,empresa)').gte('data_hora', hojeIso),
      supabaseAdmin.from('instancias_whatsapp').select('nome, status, agente_id'),
      supabaseAdmin.from('atividades_comercial').select('*, leads(nome,empresa), perfis(nome)').order('criado_em', { ascending: false }).limit(20)
    ]);

    const total_leads = (leads || []).length;
    const contatados_hoje = (leads || []).filter(l => l.ultima_interacao >= hojeIso).length;
    const com_interesse = (leads || []).filter(l => l.interesse_detectado).length;
    const no_kanban = (leads || []).filter(l => l.no_kanban).length;
    const fechados = (ops || []).filter(o => o.etapa === 'fechado').length;
    const perdidos_ops = (ops || []).filter(o => o.etapa === 'perdido').length;
    const reunioes_hoje = (reunioes || []).length;
    const taxa_resposta = total_leads > 0 ? ((com_interesse / total_leads) * 100).toFixed(1) : 0;

    res.json({
      kpis: { total_leads, contatados_hoje, taxa_resposta, com_interesse,
              no_kanban, reunioes_hoje, fechados, perdidos_ops },
      reunioes_hoje: reunioes || [],
      atividades_recentes: atividades || [],
      instancias: instancias || []
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao carregar dashboard comercial' });
  }
});

module.exports = router;
