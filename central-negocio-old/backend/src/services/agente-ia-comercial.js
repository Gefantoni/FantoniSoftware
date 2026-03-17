// Serviço de IA Comercial
// Recursos:
//   - buildSystemPrompt: monta prompt a partir de todos os campos do agente
//   - Function Calling (OpenAI): mover_status_kanban, agendar_reuniao,
//     reagendar_reuniao, cancelar_reuniao (com validação de conflito de horário)
//   - transcreverAudio: Whisper (OpenAI)
//   - analisarImagem: Vision GPT-4o-mini

const OpenAI = require('openai');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { supabaseAdmin } = require('../supabase');

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(agente) {
  const partes = [];

  if (agente.system_prompt) {
    partes.push(agente.system_prompt);
  } else {
    const identidade = [
      agente.nome      && `Você é ${agente.nome}.`,
      agente.funcao    && `Sua função: ${agente.funcao}.`,
      agente.objetivo  && `Seu objetivo: ${agente.objetivo}.`,
      agente.nicho     && `Nicho de atuação: ${agente.nicho}.`
    ].filter(Boolean).join(' ');
    if (identidade) partes.push(identidade);
  }

  if (agente.descricao_operacional)
    partes.push(`\n## Contexto Operacional\n${agente.descricao_operacional}`);

  const fmt = [];
  if (agente.tom_voz) fmt.push(`Tom de voz: ${agente.tom_voz}`);
  if (agente.tamanho_resposta) {
    const desc = { curto: 'Respostas curtas (1-2 frases)', medio: 'Respostas médias (3-5 frases)', longo: 'Respostas detalhadas' };
    fmt.push(desc[agente.tamanho_resposta] || agente.tamanho_resposta);
  }
  if (agente.usar_emoji === false) fmt.push('Não use emojis');
  if (agente.usar_emoji === true)  fmt.push('Pode usar emojis com moderação');
  if (fmt.length) partes.push(`\n## Formato\n${fmt.join('. ')}.`);

  if (agente.pode_falar_preco === true) {
    const p = ['Você PODE e DEVE falar sobre preços quando perguntado.'];
    if (agente.situacoes_preco) p.push(`Situações: ${agente.situacoes_preco}`);
    partes.push(`\n## Política de Preços\n${p.join('\n')}`);
  } else if (agente.pode_falar_preco === false) {
    partes.push('\n## Política de Preços\nNão revele preços. Direcione para falar com um consultor.');
  }

  if (agente.objetivo_conversa)
    partes.push(`\n## Objetivo da Conversa\n${agente.objetivo_conversa}`);
  if (agente.instrucoes_complementares)
    partes.push(`\n## Instruções Complementares\n${agente.instrucoes_complementares}`);

  const fluxo = [];
  if (agente.quando_insistir)           fluxo.push(`Quando insistir: ${agente.quando_insistir}`);
  if (agente.quando_parar)              fluxo.push(`Quando parar: ${agente.quando_parar}`);
  if (agente.quando_chamar_humano)      fluxo.push(`Quando chamar humano: ${agente.quando_chamar_humano}`);
  if (agente.quando_criar_oportunidade) fluxo.push(`Quando criar oportunidade: ${agente.quando_criar_oportunidade}`);
  if (agente.quando_agendar)            fluxo.push(`Quando agendar: ${agente.quando_agendar}`);
  if (fluxo.length) partes.push(`\n## Regras de Fluxo\n${fluxo.join('\n')}`);

  const qualif = [];
  if (agente.criterios_dor)       qualif.push(`Sinais de dor: ${agente.criterios_dor}`);
  if (agente.criterios_interesse) qualif.push(`Sinais de interesse: ${agente.criterios_interesse}`);
  if (qualif.length) partes.push(`\n## Qualificação\n${qualif.join('\n')}`);

  if (agente.regras_negativas)
    partes.push(`\n## O Que NÃO Fazer\n${agente.regras_negativas}`);
  if (agente.exemplos_comportamento)
    partes.push(`\n## Exemplos de Comportamento\n${agente.exemplos_comportamento}`);
  if (agente.regra_followup) partes.push(`\n## Follow-up\n${agente.regra_followup}`);
  if (agente.regra_perda)    partes.push(`\n## Tratamento de Perda\n${agente.regra_perda}`);

  return partes.join('\n') || 'Você é um assistente virtual prestativo.';
}

// ── Definições de Tools (Function Calling OpenAI) ─────────────────────────────

const TOOL_MOVER_KANBAN = {
  type: 'function',
  function: {
    name: 'mover_status_kanban',
    description: 'Move a oportunidade do lead para uma nova etapa do funil de vendas (kanban).',
    parameters: {
      type: 'object',
      properties: {
        oportunidade_id: { type: 'integer', description: 'ID da oportunidade (ver seção Contexto do Lead)' },
        etapa_nova: {
          type: 'string',
          enum: ['contato', 'qualificado', 'proposta', 'negociacao', 'reuniao_agendada', 'fechado', 'perdido'],
          description: 'Nova etapa do funil'
        },
        observacao: { type: 'string', description: 'Motivo ou contexto' }
      },
      required: ['oportunidade_id', 'etapa_nova']
    }
  }
};

const TOOL_AGENDAR_REUNIAO = {
  type: 'function',
  function: {
    name: 'agendar_reuniao',
    description: 'Agenda uma reunião com o lead. Verifica conflitos de horário automaticamente. Use somente quando o lead confirmar data e hora.',
    parameters: {
      type: 'object',
      properties: {
        titulo:          { type: 'string',  description: 'Título da reunião (ex: "Demo com João")' },
        data_hora:       { type: 'string',  description: 'Data e hora ISO 8601 (ex: 2025-03-20T14:00:00-03:00)' },
        duracao_min:     { type: 'integer', description: 'Duração em minutos (padrão 60)' },
        oportunidade_id: { type: 'integer', description: 'ID da oportunidade associada (opcional)' },
        observacoes:     { type: 'string',  description: 'Notas adicionais' }
      },
      required: ['titulo', 'data_hora']
    }
  }
};

const TOOL_REAGENDAR_REUNIAO = {
  type: 'function',
  function: {
    name: 'reagendar_reuniao',
    description: 'Reagenda uma reunião existente para nova data/hora. Verifica conflitos.',
    parameters: {
      type: 'object',
      properties: {
        reuniao_id:     { type: 'integer', description: 'ID da reunião a ser reagendada' },
        nova_data_hora: { type: 'string',  description: 'Nova data/hora ISO 8601' },
        motivo:         { type: 'string',  description: 'Motivo do reagendamento' }
      },
      required: ['reuniao_id', 'nova_data_hora']
    }
  }
};

const TOOL_CANCELAR_REUNIAO = {
  type: 'function',
  function: {
    name: 'cancelar_reuniao',
    description: 'Cancela uma reunião agendada.',
    parameters: {
      type: 'object',
      properties: {
        reuniao_id: { type: 'integer', description: 'ID da reunião' },
        motivo:     { type: 'string',  description: 'Motivo do cancelamento' }
      },
      required: ['reuniao_id']
    }
  }
};

// ── Execução das Funções ──────────────────────────────────────────────────────

async function executarFuncao(nome, args, contexto) {
  const { lead_id } = contexto;

  // ── mover_status_kanban ──────────────────────────────────────────────────
  if (nome === 'mover_status_kanban') {
    const { oportunidade_id, etapa_nova, observacao } = args;

    const { data: op } = await supabaseAdmin
      .from('oportunidades').select('etapa, titulo').eq('id', oportunidade_id).single();
    if (!op) return { sucesso: false, mensagem: `Oportunidade ${oportunidade_id} não encontrada` };

    await supabaseAdmin.from('oportunidades').update({
      etapa: etapa_nova,
      atualizado_em: new Date().toISOString()
    }).eq('id', oportunidade_id);

    await supabaseAdmin.from('oportunidades_movimentacoes').insert({
      oportunidade_id,
      etapa_anterior: op.etapa,
      etapa_nova,
      observacao: observacao || 'Movido pela IA'
    });

    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'kanban_movido',
      lead_id,
      oportunidade_id,
      descricao: `IA moveu "${op.titulo}": ${op.etapa} → ${etapa_nova}${observacao ? ` (${observacao})` : ''}`
    });

    return { sucesso: true, mensagem: `Oportunidade "${op.titulo}" movida para "${etapa_nova}"` };
  }

  // ── agendar_reuniao ──────────────────────────────────────────────────────
  if (nome === 'agendar_reuniao') {
    const { titulo, data_hora, duracao_min = 60, oportunidade_id, observacoes } = args;

    // Verifica conflito real (sobreposição de janelas de tempo)
    const inicio = new Date(data_hora);
    const fim    = new Date(inicio.getTime() + duracao_min * 60000);

    const { data: candidatos } = await supabaseAdmin
      .from('reunioes')
      .select('id, titulo, data_hora, duracao_min')
      .eq('status', 'agendada')
      .lt('data_hora', fim.toISOString())
      .gte('data_hora', new Date(inicio.getTime() - 4 * 3600000).toISOString()); // janela de 4h

    const conflito = (candidatos || []).find(c => {
      const cInicio = new Date(c.data_hora);
      const cFim    = new Date(cInicio.getTime() + (c.duracao_min || 60) * 60000);
      return inicio < cFim && fim > cInicio;
    });

    if (conflito) {
      const h = new Date(conflito.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return { sucesso: false, conflito: true, mensagem: `Horário ocupado: "${conflito.titulo}" já está agendado às ${h}. Sugira outro horário.` };
    }

    const { data: reuniao, error } = await supabaseAdmin.from('reunioes').insert({
      lead_id,
      oportunidade_id: oportunidade_id || null,
      titulo, data_hora,
      duracao_min,
      observacoes,
      origem: 'ia',
      status: 'agendada'
    }).select().single();

    if (error) return { sucesso: false, mensagem: 'Erro ao criar reunião: ' + error.message };

    if (oportunidade_id) {
      await supabaseAdmin.from('oportunidades').update({
        etapa: 'reuniao_agendada', atualizado_em: new Date().toISOString()
      }).eq('id', oportunidade_id);
      await supabaseAdmin.from('oportunidades_movimentacoes').insert({
        oportunidade_id, etapa_nova: 'reuniao_agendada',
        observacao: `Reunião agendada pela IA: ${titulo}`
      });
    }

    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'reuniao_criada', lead_id,
      oportunidade_id: oportunidade_id || null,
      reuniao_id: reuniao.id,
      descricao: `IA agendou "${titulo}" para ${new Date(data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    });

    const h = new Date(data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    return { sucesso: true, reuniao_id: reuniao.id, mensagem: `Reunião "${titulo}" agendada para ${h}` };
  }

  // ── reagendar_reuniao ────────────────────────────────────────────────────
  if (nome === 'reagendar_reuniao') {
    const { reuniao_id, nova_data_hora, motivo } = args;

    const { data: reuniao } = await supabaseAdmin
      .from('reunioes').select('*').eq('id', reuniao_id).single();
    if (!reuniao) return { sucesso: false, mensagem: 'Reunião não encontrada' };

    const duracao = reuniao.duracao_min || 60;
    const inicio  = new Date(nova_data_hora);
    const fim     = new Date(inicio.getTime() + duracao * 60000);

    const { data: candidatos } = await supabaseAdmin
      .from('reunioes')
      .select('id, titulo, data_hora, duracao_min')
      .eq('status', 'agendada')
      .neq('id', reuniao_id)
      .lt('data_hora', fim.toISOString())
      .gte('data_hora', new Date(inicio.getTime() - 4 * 3600000).toISOString());

    const conflito = (candidatos || []).find(c => {
      const cInicio = new Date(c.data_hora);
      const cFim    = new Date(cInicio.getTime() + (c.duracao_min || 60) * 60000);
      return inicio < cFim && fim > cInicio;
    });

    if (conflito) {
      const h = new Date(conflito.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return { sucesso: false, conflito: true, mensagem: `Novo horário ocupado por "${conflito.titulo}" às ${h}.` };
    }

    await supabaseAdmin.from('reunioes').update({
      data_hora: nova_data_hora,
      observacoes: motivo ? `[IA: ${motivo}] ${reuniao.observacoes || ''}`.trim() : reuniao.observacoes,
      atualizado_em: new Date().toISOString()
    }).eq('id', reuniao_id);

    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'reuniao_reagendada', lead_id, reuniao_id,
      descricao: `IA reagendou "${reuniao.titulo}" para ${new Date(nova_data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${motivo ? `: ${motivo}` : ''}`
    });

    const h = new Date(nova_data_hora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    return { sucesso: true, mensagem: `Reunião reagendada para ${h}` };
  }

  // ── cancelar_reuniao ─────────────────────────────────────────────────────
  if (nome === 'cancelar_reuniao') {
    const { reuniao_id, motivo } = args;

    const { data: reuniao } = await supabaseAdmin
      .from('reunioes').select('titulo, lead_id').eq('id', reuniao_id).single();
    if (!reuniao) return { sucesso: false, mensagem: 'Reunião não encontrada' };

    await supabaseAdmin.from('reunioes').update({
      status: 'cancelada',
      observacoes: motivo || 'Cancelada pela IA',
      atualizado_em: new Date().toISOString()
    }).eq('id', reuniao_id);

    await supabaseAdmin.from('atividades_comercial').insert({
      tipo: 'reuniao_cancelada',
      lead_id: lead_id || reuniao.lead_id, reuniao_id,
      descricao: `IA cancelou "${reuniao.titulo}"${motivo ? `: ${motivo}` : ''}`
    });

    return { sucesso: true, mensagem: `Reunião "${reuniao.titulo}" cancelada` };
  }

  return { sucesso: false, mensagem: `Função desconhecida: ${nome}` };
}

// ── Ponto de Entrada Principal ────────────────────────────────────────────────

// contexto = { lead_id, oportunidades: [{ id, titulo, etapa }] }
async function responderComAgente(agente, mensagem, historico = [], contexto = {}) {
  const provider = agente.provider || 'openai';
  const apiKey   = agente.api_key  || process.env.OPENAI_API_KEY;
  let   systemPrompt = buildSystemPrompt(agente);

  // Injeta oportunidades abertas para que a IA conheça os IDs disponíveis
  if (contexto.oportunidades?.length > 0) {
    systemPrompt += '\n\n## Contexto do Lead Atual\nOportunidades abertas (use estes IDs nas funções):\n' +
      contexto.oportunidades.map(o => `- ID ${o.id}: "${o.titulo}" (etapa: ${o.etapa})`).join('\n');
  }

  // ── OpenAI (com Function Calling) ───────────────────────────────────────
  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });

    // Inclui apenas os tools que o agente tem permissão de usar
    const tools = [];
    if (agente.pode_mover_kanban) tools.push(TOOL_MOVER_KANBAN);
    if (agente.pode_agendar) {
      tools.push(TOOL_AGENDAR_REUNIAO);
      tools.push(TOOL_REAGENDAR_REUNIAO);
      tools.push(TOOL_CANCELAR_REUNIAO);
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historico.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: mensagem }
    ];

    const reqParams = { model: 'gpt-4o-mini', messages, max_tokens: 600, temperature: 0.7 };
    if (tools.length > 0) { reqParams.tools = tools; reqParams.tool_choice = 'auto'; }

    let completion  = await openai.chat.completions.create(reqParams);
    let respostaMsg = completion.choices[0].message;

    // Loop de Function Calling — máx 3 rodadas para evitar recursão infinita
    for (let rodada = 0; rodada < 3 && respostaMsg.tool_calls?.length > 0; rodada++) {
      messages.push(respostaMsg);

      const toolResults = [];
      for (const tc of respostaMsg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        const resultado = await executarFuncao(tc.function.name, args, contexto);
        toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }
      messages.push(...toolResults);

      completion  = await openai.chat.completions.create({ ...reqParams, messages, max_tokens: 500 });
      respostaMsg = completion.choices[0].message;
    }

    return respostaMsg.content || '';
  }

  // ── Gemini (sem Function Calling — API diferente) ────────────────────────
  if (provider === 'gemini') {
    let GoogleGenerativeAI;
    try {
      GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    } catch {
      try {
        GoogleGenerativeAI = require('@google/genai').GoogleGenerativeAI;
      } catch {
        throw new Error('Pacote Gemini não instalado. Execute: npm install @google/generative-ai');
      }
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat  = model.startChat({
      history: [
        { role: 'user',  parts: [{ text: 'Considere este prompt de sistema: ' + systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido.' }] },
        ...historico.map(h => ({
          role:  h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }))
      ]
    });
    const result = await chat.sendMessage(mensagem);
    return result.response.text();
  }

  throw new Error('Provedor de IA desconhecido');
}

// ── Transcrição de Áudio (Whisper) ────────────────────────────────────────────

async function transcreverAudio(audioMessage) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let audioBuffer;
    if (audioMessage.url?.startsWith('http')) {
      const response = await axios.get(audioMessage.url, { responseType: 'arraybuffer' });
      audioBuffer = Buffer.from(response.data);
    } else if (audioMessage.base64) {
      audioBuffer = Buffer.from(audioMessage.base64, 'base64');
    } else {
      return '(Áudio recebido, mas mídia não disponível para download automático)';
    }

    const tempFile = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
    fs.writeFileSync(tempFile, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file:  fs.createReadStream(tempFile),
      model: 'whisper-1'
    });

    fs.unlinkSync(tempFile);
    return transcription.text;
  } catch (err) {
    console.error('Erro Whisper:', err.message);
    return '[Falha ao transcrever áudio]';
  }
}

// ── Análise de Imagem (Vision) ────────────────────────────────────────────────

async function analisarImagem(imageMessage) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let imageUrl;
    if (imageMessage.base64) {
      imageUrl = `data:image/jpeg;base64,${imageMessage.base64}`;
    } else if (imageMessage.url?.startsWith('http')) {
      const response = await axios.get(imageMessage.url, { responseType: 'arraybuffer' });
      imageUrl = `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
    } else {
      return '(Imagem recebida, mas não foi possível carregar o conteúdo visual)';
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Descreva o que você vê nesta imagem de forma curta e objetiva para um assistente comercial brasileiro.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }]
    });
    return response.choices[0].message.content;
  } catch (err) {
    console.error('Erro Vision:', err.message);
    return '[Falha ao analisar imagem]';
  }
}

module.exports = { responderComAgente, transcreverAudio, analisarImagem };
