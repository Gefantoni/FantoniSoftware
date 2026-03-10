// Serviço de integração com a OpenAI
const OpenAI = require('openai');
const { supabaseAdmin } = require('../supabase');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Busca artigos da base de conhecimento por palavras-chave (busca simples)
async function buscarBaseConhecimento(pergunta) {
  try {
    const palavras = pergunta.toLowerCase().split(/\s+/).filter(p => p.length > 3);

    const { data, error } = await supabaseAdmin
      .from('base_conhecimento')
      .select('*')
      .eq('ativo', true);

    if (error || !data) return [];

    // Pontua cada item pela quantidade de palavras-chave que aparecem
    const pontuados = data.map(item => {
      const textoItem = `${item.pergunta} ${item.resposta} ${(item.tags || []).join(' ')}`.toLowerCase();
      const pontos = palavras.filter(p => textoItem.includes(p)).length;
      return { ...item, pontos };
    });

    return pontuados
      .filter(i => i.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 3); // top 3 resultados
  } catch (err) {
    console.error('Erro ao buscar base de conhecimento:', err);
    return [];
  }
}

// Responde uma dúvida do cliente usando GPT-4o-mini + base de conhecimento
async function responderDuvida(pergunta, historicoConversa = []) {
  try {
    // Busca contexto na base de conhecimento
    const baseRelevante = await buscarBaseConhecimento(pergunta);
    const contexto = baseRelevante.length > 0
      ? baseRelevante.map(b => `Pergunta: ${b.pergunta}\nResposta: ${b.resposta}`).join('\n\n')
      : 'Nenhuma informação específica encontrada na base de conhecimento.';

    const videoRelacionado = baseRelevante.find(b => b.url_video)?.url_video || null;

    const systemPrompt = `Você é um assistente de suporte especialista no sistema PDV da empresa.
Responda sempre em português brasileiro, de forma clara e direta.
Quando houver um vídeo relacionado à dúvida, mencione que existe um vídeo tutorial disponível.
Se não souber a resposta, oriente o cliente a abrir um chamado de suporte.
Use apenas as informações da base de conhecimento fornecida. Não invente respostas.

Base de conhecimento:
${contexto}`;

    const mensagens = [
      { role: 'system', content: systemPrompt },
      ...historicoConversa.slice(-10), // mantém últimas 10 mensagens do histórico
      { role: 'user', content: pergunta }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: mensagens,
      max_tokens: 500,
      temperature: 0.4
    });

    const resposta = completion.choices[0].message.content;

    return { resposta, videoRelacionado, fontes: baseRelevante };
  } catch (err) {
    console.error('Erro ao chamar OpenAI:', err);
    throw new Error('Erro ao processar sua pergunta. Tente novamente.');
  }
}

// Gera nome, descrição e prompt de imagem para item de cardápio
async function gerarDescricaoCardapio({ nomePrato, ingredientes, estilo, plataforma, imagemBase64, instrucoes }) {
  const systemPrompt = `Você é um especialista em copywriting de cardápios e marketing gastronômico.
Seu objetivo é ajudar donos de bares e restaurantes a criar descrições irresistíveis para seus pratos nos apps de delivery.
Responda SEMPRE em JSON válido, sem texto fora do JSON.`;

  let userContent = `Crie a ficha de marketing para o seguinte prato:
- Nome atual do prato: ${nomePrato}
- Ingredientes principais: ${ingredientes}
- Estilo do estabelecimento: ${estilo}
- Plataforma de destino: ${plataforma || 'iFood/Rappi'}`;

  if (instrucoes) {
    userContent += `\n- Instruções e desejos do cliente (MUITO IMPORTANTE): ${instrucoes}`;
  }

  userContent += `\n\nRetorne EXATAMENTE este JSON (sem markdown, sem explicação):
{
  "nome_sugerido": "Nome atrativo para o cardápio (máximo 40 caracteres)",
  "descricao_completa": "Descrição irresistível de 2-3 frases que usa palavras sensoriais e desperta apetite (máximo 200 caracteres)",
  "descricao_curta": "Versão ultra-curta para lista do cardápio (máximo 80 caracteres)",
  "prompt_imagem": "Prompt em inglês para gerar foto do prato no DALL-E. IMPORTANTE: O prompt DEVE exigir estilo fotorealista, 'high-end food photography', iluminação de estúdio natural, lente macro 85mm. PROIBIDO estilos de desenho, ilustração, cartum ou 3D render.",
  "dicas": ["dica 1 de como melhorar a apresentação do prato", "dica 2 de precificação ou destaque"]
}`;

  // Se houver imagem, usa o formato de array pro Vision API
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (imagemBase64) {
    userContent += '\n\nAnalise a imagem enviada para extrair os detalhes visuais reais (cores, texturas, empratamento) e usá-los na sua descrição e no prompt.';
    messages.push({
      role: 'user',
      content: [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: imagemBase64 } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: userContent });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0].message.content;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao gerar descrição de cardápio:', err);
    throw new Error('Erro ao gerar descrição. Verifique a imagem ou tente novamente.');
  }
}

// Gera imagem com DALL-E 3 a partir do prompt
async function gerarUrlImagem(prompt) {
  try {
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard"
    });
    return image.data[0].url;
  } catch (err) {
    console.error('Erro gerando imagem DALL-E 3:', err);
    throw new Error('Erro ao gerar imagem. Verifique se sua chave API tem permissão / saldo para DALL-E 3.');
  }
}

module.exports = { responderDuvida, buscarBaseConhecimento, gerarDescricaoCardapio, gerarUrlImagem };
