// Popula base de conhecimento e videoaulas com conteúdo do Navi Vendas
require('dotenv').config();
const axios = require('axios');

const REF   = 'xkeqoljarybjgekcwmfw';
const TOKEN = 'sbp_158630cffdf639c6ca7ce581b6034be5aa815d70';
const BASE_TUTORIAL = 'https://ajuda.navivendas.com.br/tutoriais';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function sql(query) {
  const { data } = await axios.post(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    { query },
    { headers }
  );
  return data;
}

// ── VÍDEOS DO YOUTUBE (canal Navi Vendas — sem publicitários) ──────────────
const videos = [
  { id: 'EPf00K3u1Xc', titulo: 'Treinamento — Mesas e Comandas',          tags: ['mesas','comandas','treinamento'] },
  { id: 'z27SH4d-QQI', titulo: 'Navi Vendas — Consulta Preço',            tags: ['consulta','preço','totem'] },
  { id: 'nsLtgn1DYkg', titulo: 'Navi Vendas — Monitor de Cozinha',        tags: ['cozinha','monitor','pedido'] },
  { id: 'mUVRP74wD-4', titulo: 'Navi Vendas — Pesagem Automática',        tags: ['balança','pesagem','buffet'] },
  { id: 'flNkuKC8J2g', titulo: 'Demonstração completa do Navi Vendas',    tags: ['demonstração','sistema','overview'] },
  { id: 'PgsRmIuHf0Y', titulo: 'Cadastro de produtos Multissabor',        tags: ['multissabor','produto','cadastro'] },
  { id: 'Dhv7Zn7gR9w', titulo: 'Balanço de estoque',                      tags: ['estoque','balanço','inventário'] },
  { id: '8ftstBli56A', titulo: 'Entrada manual no estoque',               tags: ['estoque','entrada','manual'] },
  { id: 'HeZURf37kbY', titulo: 'Importação de Nota Fiscal',               tags: ['nota','fiscal','importação','xml','sefaz'] },
];

// ── BASE DE CONHECIMENTO (40 tutoriais) ────────────────────────────────────
const baseConhecimento = [
  // CAIXA
  {
    pergunta: 'Como fazer abertura e fechamento de caixa?',
    resposta: 'Para abrir o caixa: acesse o módulo Caixa, informe o valor inicial (troco) e confirme. Para fechar: acesse o menu Caixa > Totais em caixa, confirme e gere o relatório de fechamento. O "Suprimento" é uma entrada de dinheiro para adicionar troco durante o dia.',
    url_video: 'https://www.youtube.com/embed/EPf00K3u1Xc',
    url_tutorial: `${BASE_TUTORIAL}/abertura-e-fechamento-de-caixa`,
    tags: ['caixa','abertura','fechamento','troco','suprimento']
  },
  {
    pergunta: 'Como realizar uma venda rápida?',
    resposta: 'Abra o módulo Caixa, busque os produtos por código de barras ou pesquisa manual, ajuste as quantidades, clique em "Pagamento" (ou F9), escolha a forma de pagamento e finalize clicando em "Finalizar negociação" (ou F9/Enter). O comprovante será exibido.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/venda-rapida`,
    tags: ['venda','caixa','rápida','pagamento','finalizar']
  },
  {
    pergunta: 'Como receber pagamento via Pix?',
    resposta: 'No Caixa, selecione os produtos normalmente, vá para Pagamento, escolha Pix como forma de pagamento e finalize. O cliente escaneia o QR Code gerado (que usa sua chave Pix configurada). Atenção: o sistema não confirma o recebimento automaticamente — você deve verificar no seu app do banco.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/venda-pix`,
    tags: ['pix','pagamento','qrcode','venda']
  },
  {
    pergunta: 'Como configurar a chave Pix?',
    resposta: 'Acesse Configurações > Formas de Pagamento > Pix, selecione o local (Caixa ou Catálogo Online), informe sua chave Pix existente e salve. Se a Conta Digital estiver ativa junto com o Pix, as transações priorizarão a Conta Digital.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/chave-pix`,
    tags: ['pix','chave','configuração','pagamento']
  },
  {
    pergunta: 'Como excluir ou cancelar uma venda?',
    resposta: 'No módulo Caixa, localize a venda, clique nela para abrir, acesse o menu lateral e confirme a exclusão. A venda aparecerá como "Cancelada". Atenção: não é possível excluir vendas feitas em outros dispositivos. Se a NFC-e foi emitida, ela será cancelada na Sefaz automaticamente (dentro de ~30 minutos).',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/excluir-vendas`,
    tags: ['excluir','cancelar','venda','nfce','caixa']
  },
  {
    pergunta: 'Como receber pagamento de crediário?',
    resposta: 'No módulo Caixa, acesse a opção de Recebimentos, busque o cliente, selecione a(s) parcela(s) a receber ou renegociar, escolha a forma de pagamento e finalize. Você pode verificar o status financeiro no cadastro do cliente após o recebimento.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/recebimento-crediario`,
    tags: ['crediário','parcela','recebimento','cliente','financeiro']
  },
  {
    pergunta: 'Como configurar a abertura automática da gaveta de dinheiro?',
    resposta: 'A gaveta deve ser conectada à impressora via cabo RJ-35. Acesse Configurações > Impressora, ative a opção de gaveta, selecione o modelo da impressora e salve. Impressoras Elgin possuem comandos específicos de abertura.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/configurar-abertura-de-gaveta`,
    tags: ['gaveta','dinheiro','impressora','configuração']
  },
  {
    pergunta: 'Como solicitar CPF na nota fiscal?',
    resposta: 'Acesse Configurações e ative a solicitação de CPF/CNPJ no caixa. Você pode tornar obrigatório ou opcional, com limite de valor (ex: acima de R$500 solicita automaticamente). A configuração é por dispositivo. Alguns estados exigem CPF em compras acima de certos valores.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/solicitar-cpf-na-nota-fiscal`,
    tags: ['cpf','nota','fiscal','nfce','configuração']
  },

  // PRODUTOS / ESTOQUE
  {
    pergunta: 'Como cadastrar um produto multissabor (ex: pizza, açaí)?',
    resposta: 'Acesse o módulo Produtos, ative a opção de Multissabor no produto. Escolha o cálculo de preço: "Proporcional" (divide o preço entre os sabores) ou "Maior Preço" (cobra o maior preço entre os sabores selecionados). Adicione as opções de sabor via busca e defina o limite máximo de sabores por pedido.',
    url_video: 'https://www.youtube.com/embed/PgsRmIuHf0Y',
    url_tutorial: `${BASE_TUTORIAL}/cadastro-de-produto-multissabor`,
    tags: ['multissabor','pizza','sabor','produto','cadastro']
  },
  {
    pergunta: 'Como adicionar complementos a um produto (ex: adicionais, personalizações)?',
    resposta: 'No cadastro do produto, adicione itens de complemento com nome e preço. Defina a quantidade mínima (que solicita automaticamente ao cliente) e máxima (limita as escolhas). No Caixa, o cliente pode clicar em "Alterar complementos" para visualizar e selecionar.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/produtos-com-complementos`,
    tags: ['complemento','adicional','produto','personalização']
  },
  {
    pergunta: 'Como fazer entrada manual de mercadoria no estoque?',
    resposta: 'Acesse o módulo Estoque > Entrada manual, selecione ou cadastre o fornecedor, adicione os produtos (por desktop, celular ou POS), informe preço de custo e quantidade. Você pode ajustar o preço de venda ou margem de lucro. É possível criar produtos novos durante a entrada.',
    url_video: 'https://www.youtube.com/embed/8ftstBli56A',
    url_tutorial: `${BASE_TUTORIAL}/entrada-manual-no-estoque`,
    tags: ['estoque','entrada','mercadoria','fornecedor','custo']
  },
  {
    pergunta: 'Como fazer balanço (contagem) de estoque?',
    resposta: 'Acesse Estoque > Balanço, inicie uma nova contagem, selecione os grupos de produtos, registre as quantidades (por leitor de código de barras ou digitação manual). Você pode salvar parcialmente ou finalizar. O relatório mostrará as diferenças entre o estoque registrado e o contado.',
    url_video: 'https://www.youtube.com/embed/Dhv7Zn7gR9w',
    url_tutorial: `${BASE_TUTORIAL}/balanco-de-estoque`,
    tags: ['estoque','balanço','contagem','inventário','diferença']
  },
  {
    pergunta: 'Como importar nota fiscal de compra para dar entrada no estoque?',
    resposta: 'Acesse Estoque > Notas Fiscais. Importe o XML salvo localmente ou busque direto da Sefaz (últimos 90 dias). Vincule os produtos automaticamente ou cadastre os novos manualmente. Defina preços de venda antes de finalizar para atualizar o estoque.',
    url_video: 'https://www.youtube.com/embed/HeZURf37kbY',
    url_tutorial: `${BASE_TUTORIAL}/importacao-de-nota-fiscal`,
    tags: ['nota','fiscal','xml','sefaz','estoque','importação','compra']
  },
  {
    pergunta: 'Como exibir a quantidade de estoque no caixa?',
    resposta: 'Acesse Configurações e ative a opção "Exibir quantidade de estoque em cada produto". Após ativar, a quantidade disponível aparecerá junto ao produto no caixa.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/exibir-a-quantidade-de-estoque-em-cada-produto`,
    tags: ['estoque','quantidade','caixa','produto']
  },
  {
    pergunta: 'Como exibir apenas produtos com estoque disponível no caixa?',
    resposta: 'Acesse Configurações e ative a opção "Exibir apenas produtos com estoque". Assim, produtos zerados não aparecerão na tela de vendas.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/exibir-apenas-produtos-com-estoque`,
    tags: ['estoque','produto','caixa','filtro']
  },

  // USUÁRIOS E CONFIGURAÇÕES
  {
    pergunta: 'Como cadastrar usuários e funcionários?',
    resposta: 'Acesse Configurações > Usuários e adicione um novo usuário. Existem 3 perfis: Administrador (acesso total), Caixa (acesso ao módulo de vendas) e Atendente (acesso limitado). Configure nome, login, senha e comissão (%). Restrições como cancelamentos e descontos exigem autenticação do administrador.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/cadastro-usuarios`,
    tags: ['usuário','funcionário','cadastro','perfil','acesso','senha']
  },
  {
    pergunta: 'Como configurar restrições de acesso para funcionários?',
    resposta: 'Acesse Configurações > Restrições de Acesso. Você pode restringir: (1) Cancelamento de itens/vendas — exige senha do admin; (2) Reimpressão de comprovante; (3) Transferência de produtos entre mesas; (4) Adicionar complementos; (5) Aplicar desconto — com percentual máximo definido pelo admin.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/configurar-restricao-de-acessos`,
    tags: ['restrição','acesso','funcionário','desconto','cancelamento','senha']
  },
  {
    pergunta: 'Como configurar a impressora?',
    resposta: 'Acesse Configurações > Impressora. Tipos de conexão suportados: (1) Bluetooth — para celulares e smart POS; (2) Rede/IP — para Windows e mobile; (3) USB — apenas para Windows. Configure a largura do papel (58mm ou 80mm) e o tamanho da fonte. Use "Imprimir teste" para verificar se funcionou.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/configuracao-impressora`,
    tags: ['impressora','configuração','bluetooth','usb','rede','papel']
  },
  {
    pergunta: 'Como configurar pontos de impressão para pedidos (cozinha, bar)?',
    resposta: 'Acesse Configurações > Pontos de Impressão. Adicione um novo ponto com nome (ex: "Cozinha"), selecione os produtos que devem ser impressos nele, ative a impressão e informe o IP e porta da impressora de rede (Ethernet). Assim cada setor recebe automaticamente só os pedidos relevantes.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/pontos-de-impressao`,
    tags: ['impressão','cozinha','bar','ponto','pedido','rede']
  },
  {
    pergunta: 'Como compartilhar dados entre vários dispositivos (celulares, tablets)?',
    resposta: 'Acesse Configurações > Compartilhar Dados e siga as instruções para sincronizar produtos, clientes e configurações entre múltiplos dispositivos do mesmo estabelecimento. Os dispositivos devem estar na mesma conta.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/compartilhar-dados-entre-multiplos-dispositivos`,
    tags: ['sincronização','dispositivo','compartilhar','dados','tablet']
  },
  {
    pergunta: 'Como inserir o certificado digital A1?',
    resposta: 'Acesse a página da sua conta Navi Vendas, vá em Certificado Digital e faça o upload do arquivo .pfx junto com a senha do certificado. Isso é necessário para emissão de NFC-e e NF-e.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/inserir-certificado-digital-pela-pagina-conta`,
    tags: ['certificado','digital','nfce','nfe','a1','pfx']
  },
  {
    pergunta: 'Como configurar a impressão automática de comprovantes?',
    resposta: 'Acesse Configurações > Impressão e ative a impressão automática de comprovantes. Assim o comprovante será impresso automaticamente ao finalizar cada venda, sem precisar confirmar manualmente.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/configurar-impressao-automatica-de-comprovantes`,
    tags: ['impressão','comprovante','automático','configuração']
  },
  {
    pergunta: 'Como preencher manualmente as informações de pagamento na NFC-e?',
    resposta: 'Quando necessário, acesse as configurações da NFC-e e ative o preenchimento manual das informações de pagamento. Isso permite inserir manualmente a forma de pagamento utilizada diretamente na nota fiscal eletrônica.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/preenchimento-manual-das-informacoes-de-pagamento-na-nfc-e`,
    tags: ['nfce','nota','fiscal','pagamento','manual']
  },
  {
    pergunta: 'Como emitir NF-e de venda (referenciar NFC-e)?',
    resposta: 'Acesse o módulo fiscal e selecione a opção de emitir NF-e de venda, referenciando a NFC-e já emitida. Informe os dados do destinatário e finalize a emissão. Útil para clientes pessoa jurídica que precisam de NF-e ao invés de NFC-e.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/nfe-de-venda`,
    tags: ['nfe','nota','fiscal','nfce','referência','pj']
  },

  // MESAS E COMANDAS
  {
    pergunta: 'Como configurar e usar mesas e comandas?',
    resposta: 'Acesse Configurações > Mesas e Comandas e ative o modo desejado (não é possível usar os dois ao mesmo tempo). Configure o intervalo de numeração e gere os QR Codes para o menu digital. Mesas: verde = disponível, vermelho = ocupada. Comandas: podem ser finalizadas em grupo no caixa. Suporte a taxa de serviço (%) e limite de consumo.',
    url_video: 'https://www.youtube.com/embed/EPf00K3u1Xc',
    url_tutorial: `${BASE_TUTORIAL}/configurar-mesas-e-comandas`,
    tags: ['mesas','comandas','restaurante','bar','qrcode','taxa','serviço']
  },
  {
    pergunta: 'Como autenticar transferência de produtos entre mesas?',
    resposta: 'Se a restrição de transferência estiver ativa (Configurações > Restrições), ao tentar transferir um produto de uma mesa para outra será solicitada a senha do administrador. Acesse Configurações > Autenticação para Transferência de Mesas para gerenciar isso.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/autenticacao-para-transferir-produtos-entre-mesas`,
    tags: ['mesa','transferência','autenticação','senha','admin']
  },
  {
    pergunta: 'Como configurar o Menu Digital (QR Code para pedidos na mesa)?',
    resposta: 'Acesse Configurações > Menu Digital. Configure: (1) Identificação — logo, cores, subdomínio (nomadaloja.menudigital.net.br); (2) Produtos — selecione os itens disponíveis; (3) Opções de Pedido — ative os pedidos e defina qual dispositivo os recebe; (4) QR Code — gere um código por mesa/comanda (válido por 24h).',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/configuracao-do-menu-digital`,
    tags: ['menu','digital','qrcode','mesa','pedido','online']
  },

  // CATÁLOGO E DELIVERY
  {
    pergunta: 'Como configurar o Catálogo Online (loja virtual)?',
    resposta: 'Acesse Configurações > Catálogo Online. Configure: logo, cores, subdomínio (nomadaloja.navivendas.com.br), produtos disponíveis e preços, horários de funcionamento, formas de pagamento (Conta Digital/Pix antecipado ou pagamento na entrega), opções de entrega (retirada/entrega/ambos) e integração com WhatsApp para alertas.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/catalogo-online`,
    tags: ['catálogo','online','loja','delivery','virtual','whatsapp']
  },
  {
    pergunta: 'Como usar o aplicativo do Catálogo Online?',
    resposta: 'O Catálogo Online possui um app próprio para que seus clientes acessem sua loja. Compartilhe o link do seu catálogo com os clientes. O app exibe seus produtos, aceita pedidos e processa pagamentos online conforme sua configuração.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/aplicativo-do-catalogo-online`,
    tags: ['catálogo','app','aplicativo','online','cliente']
  },
  {
    pergunta: 'Como configurar pagamento com a Conta Digital no Catálogo?',
    resposta: 'Na configuração do Catálogo Online, ative o pagamento via Conta Digital. Os clientes poderão pagar antecipadamente via Pix pela Conta Digital integrada, e o pedido só será confirmado após a confirmação do pagamento.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/configurar-pagamento-conta-digital`,
    tags: ['conta','digital','pagamento','catálogo','pix','online']
  },
  {
    pergunta: 'Como ver e gerenciar pedidos do Catálogo Online?',
    resposta: 'Os pedidos do Catálogo Online chegam no módulo de Pedidos ou Delivery do Navi Vendas. Você recebe uma notificação sonora. Aceite, prepare e atualize o status do pedido (em preparo, pronto, saiu para entrega) diretamente pelo sistema.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/pedido-catalogo-online`,
    tags: ['pedido','catálogo','online','delivery','status']
  },
  {
    pergunta: 'Como criar um pedido de delivery?',
    resposta: 'Acesse o módulo Delivery > Novo Pedido, busque ou cadastre o cliente, selecione os produtos no caixa, escolha entre entrega ou retirada, confirme endereço e taxa de entrega, defina quando e como o cliente vai pagar, e inicie o preparo do pedido.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/pedido-delivery`,
    tags: ['delivery','pedido','entrega','cliente','endereço']
  },
  {
    pergunta: 'Como integrar com o iFood?',
    resposta: 'Acesse Configurações > Integrações > iFood. Ative a integração, obtenha o código de ativação, autorize o aplicativo e sincronize o cardápio. Os pedidos do iFood chegam automaticamente no módulo Delivery do Navi Vendas. Configure aceite automático e notificação sonora nas opções.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/integracao-ifood`,
    tags: ['ifood','integração','delivery','pedido','cardápio']
  },

  // INTEGRAÇÕES
  {
    pergunta: 'Como usar o Monitor de Cozinha?',
    resposta: 'O Monitor de Cozinha é um app separado que exibe os pedidos em andamento para a equipe da cozinha. Acesse Configurações > Integrações > Monitor de Cozinha e vincule o dispositivo onde o monitor ficará aberto. Os pedidos aparecem automaticamente ao serem feitos.',
    url_video: 'https://www.youtube.com/embed/nsLtgn1DYkg',
    url_tutorial: `${BASE_TUTORIAL}/vinculacao-no-monitor-de-cozinha`,
    tags: ['cozinha','monitor','pedido','preparo','integração']
  },
  {
    pergunta: 'Como usar a balança de pesagem automática (buffet)?',
    resposta: 'O app Pesagem Automática permite que o cliente pese o prato e o sistema já registra o valor automaticamente. Acesse Configurações > Integrações > Pesagem Automática e vincule com o dispositivo da balança. Ideal para restaurantes self-service por quilo.',
    url_video: 'https://www.youtube.com/embed/mUVRP74wD-4',
    url_tutorial: `${BASE_TUTORIAL}/vinculacao-com-o-pesagem-automatica`,
    tags: ['balança','pesagem','buffet','quilo','self-service']
  },
  {
    pergunta: 'Como usar o Consulta Preço (totem)?',
    resposta: 'O app Consulta Preço exibe informações atualizadas dos produtos em um totem ou terminal, permitindo que os clientes consultem preços sem precisar de um atendente. Acesse Configurações > Integrações > Consulta Preço e vincule o dispositivo.',
    url_video: 'https://www.youtube.com/embed/z27SH4d-QQI',
    url_tutorial: `${BASE_TUTORIAL}/vinculacao-no-consulta-preco`,
    tags: ['consulta','preço','totem','cliente','terminal']
  },
  {
    pergunta: 'Como configurar a balança etiquetadora?',
    resposta: 'A balança etiquetadora gera etiquetas com peso e preço para produtos vendidos por peso (ex: açougue, padaria). Acesse Configurações > Balança Etiquetadora, configure o modelo e a comunicação. As etiquetas geradas têm código de barras compatível com o Navi Vendas.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/balanca-etiquetadora`,
    tags: ['balança','etiqueta','peso','açougue','padaria']
  },

  // INÍCIO
  {
    pergunta: 'Como dar os primeiros passos no Navi Vendas?',
    resposta: 'Após criar a conta com CPF ou CNPJ e escolher o plano: (1) Configure a NFC-e com os dados da empresa; (2) Cadastre os usuários; (3) Importe ou cadastre os produtos no módulo Produtos; (4) Configure a impressora; (5) Abra o Caixa para começar a vender. Para ajuda, acesse ajuda.navivendas.com.br/tutoriais.',
    url_video: 'https://www.youtube.com/embed/flNkuKC8J2g',
    url_tutorial: `${BASE_TUTORIAL}/primeiros-passos`,
    tags: ['início','primeiros','passos','configuração','conta','plano']
  },
  {
    pergunta: 'O que é o Navi Vendas?',
    resposta: 'O Navi Vendas é um sistema PDV (Ponto de Venda) completo para micro e pequenas empresas de varejo, bares e restaurantes. Funciona em celular, tablet, smart POS e computador. Possui: Caixa, Produtos, Estoque, Delivery, Mesas e Comandas, Catálogo Online, emissão de NFC-e/NF-e e várias integrações.',
    url_video: 'https://www.youtube.com/embed/flNkuKC8J2g',
    url_tutorial: `${BASE_TUTORIAL}/primeiros-passos`,
    tags: ['navi','vendas','sistema','pdv','o que é','overview']
  },

  // RELATÓRIOS
  {
    pergunta: 'Como exportar XML das notas fiscais emitidas?',
    resposta: 'Acesse o módulo de Relatórios > Exportação de XML. Selecione o período desejado e baixe os arquivos XML das NFC-e ou NF-e emitidas. Útil para contabilidade e arquivamento fiscal.',
    url_video: null,
    url_tutorial: `${BASE_TUTORIAL}/exportacao-de-xml`,
    tags: ['xml','nota','fiscal','relatório','exportação','contabilidade']
  }
];

// ── MÓDULOS DE VIDEOAULAS ──────────────────────────────────────────────────
const modulos = [
  {
    titulo: 'Apresentação do Sistema',
    descricao: 'Visão geral e demonstração completa do Navi Vendas',
    plano_minimo: 'basico',
    ordem: 1,
    aulas: [
      { titulo: 'Demonstração completa do Navi Vendas', url_video: 'https://www.youtube.com/embed/flNkuKC8J2g', duracao_seg: 480, ordem: 1 },
    ]
  },
  {
    titulo: 'Caixa e Vendas',
    descricao: 'Aprenda a usar o módulo de caixa, realizar vendas e receber pagamentos',
    plano_minimo: 'basico',
    ordem: 2,
    aulas: [
      { titulo: 'Treinamento — Mesas e Comandas', url_video: 'https://www.youtube.com/embed/EPf00K3u1Xc', duracao_seg: 600, ordem: 1 },
    ]
  },
  {
    titulo: 'Estoque',
    descricao: 'Gestão de estoque: entradas, balanço e importação de notas',
    plano_minimo: 'basico',
    ordem: 3,
    aulas: [
      { titulo: 'Entrada manual no estoque',  url_video: 'https://www.youtube.com/embed/8ftstBli56A',  duracao_seg: 360, ordem: 1 },
      { titulo: 'Balanço de estoque',         url_video: 'https://www.youtube.com/embed/Dhv7Zn7gR9w',  duracao_seg: 420, ordem: 2 },
      { titulo: 'Importação de Nota Fiscal',  url_video: 'https://www.youtube.com/embed/HeZURf37kbY',  duracao_seg: 480, ordem: 3 },
    ]
  },
  {
    titulo: 'Produtos Avançados',
    descricao: 'Multissabor, complementos e configurações especiais de produtos',
    plano_minimo: 'profissional',
    ordem: 4,
    aulas: [
      { titulo: 'Cadastro de produtos Multissabor', url_video: 'https://www.youtube.com/embed/PgsRmIuHf0Y', duracao_seg: 300, ordem: 1 },
    ]
  },
  {
    titulo: 'Mesas, Comandas e Delivery',
    descricao: 'Configure mesas, comandas, delivery e integre com iFood',
    plano_minimo: 'profissional',
    ordem: 5,
    aulas: [
      { titulo: 'Treinamento — Mesas e Comandas (completo)', url_video: 'https://www.youtube.com/embed/EPf00K3u1Xc', duracao_seg: 600, ordem: 1 },
      { titulo: 'Monitor de Cozinha',                        url_video: 'https://www.youtube.com/embed/nsLtgn1DYkg',  duracao_seg: 300, ordem: 2 },
    ]
  },
  {
    titulo: 'Integrações e Ferramentas',
    descricao: 'Pesagem automática, Consulta Preço e outras integrações',
    plano_minimo: 'premium',
    ordem: 6,
    aulas: [
      { titulo: 'Pesagem Automática (buffet/quilo)',  url_video: 'https://www.youtube.com/embed/mUVRP74wD-4', duracao_seg: 300, ordem: 1 },
      { titulo: 'Consulta Preço (totem)',             url_video: 'https://www.youtube.com/embed/z27SH4d-QQI',  duracao_seg: 300, ordem: 2 },
    ]
  },
];

async function main() {
  console.log('🚀 Iniciando populate do Navi Vendas...\n');

  // 1. Limpa base de conhecimento anterior (exceto SDR prompt)
  console.log('1. Limpando base de conhecimento anterior...');
  await sql(`DELETE FROM public.base_conhecimento WHERE pergunta != '__SDR_PROMPT__'`);
  console.log('   OK\n');

  // 2. Insere base de conhecimento
  console.log(`2. Inserindo ${baseConhecimento.length} tutoriais na base de conhecimento...`);
  for (const item of baseConhecimento) {
    const tags = JSON.stringify(item.tags);
    const url_video = item.url_video ? `'${item.url_video}'` : 'NULL';
    const url_tutorial = item.url_tutorial ? `'${item.url_tutorial}'` : 'NULL';
    const pergunta = item.pergunta.replace(/'/g, "''");
    const resposta = item.resposta.replace(/'/g, "''");

    await sql(`
      INSERT INTO public.base_conhecimento (pergunta, resposta, url_video, tags, ativo)
      VALUES ('${pergunta}', '${resposta}', ${url_video}, ARRAY[${item.tags.map(t => `'${t}'`).join(',')}], true)
    `);
    process.stdout.write('.');
  }
  console.log(`\n   ${baseConhecimento.length} itens inseridos!\n`);

  // 3. Limpa módulos e aulas anteriores
  console.log('3. Limpando módulos e aulas anteriores...');
  await sql(`DELETE FROM public.videoaulas`);
  await sql(`DELETE FROM public.modulos`);
  console.log('   OK\n');

  // 4. Insere módulos e videoaulas
  console.log(`4. Inserindo ${modulos.length} módulos com videoaulas...`);
  for (const mod of modulos) {
    const titulo = mod.titulo.replace(/'/g, "''");
    const desc   = mod.descricao.replace(/'/g, "''");

    const modResult = await sql(`
      INSERT INTO public.modulos (titulo, descricao, plano_minimo, ordem, ativo)
      VALUES ('${titulo}', '${desc}', '${mod.plano_minimo}', ${mod.ordem}, true)
      RETURNING id
    `);
    const modId = modResult[0]?.id;

    for (const aula of mod.aulas) {
      const aulaTitulo = aula.titulo.replace(/'/g, "''");
      await sql(`
        INSERT INTO public.videoaulas (modulo_id, titulo, url_video, duracao_seg, ordem, ativo)
        VALUES (${modId}, '${aulaTitulo}', '${aula.url_video}', ${aula.duracao_seg}, ${aula.ordem}, true)
      `);
    }
    console.log(`   ✓ Módulo "${mod.titulo}" — ${mod.aulas.length} aulas`);
  }

  // 5. Verifica resultado
  console.log('\n5. Verificando...');
  const totalBase   = await sql(`SELECT COUNT(*) as total FROM public.base_conhecimento WHERE pergunta != '__SDR_PROMPT__'`);
  const totalMod    = await sql(`SELECT COUNT(*) as total FROM public.modulos`);
  const totalAulas  = await sql(`SELECT COUNT(*) as total FROM public.videoaulas`);

  console.log(`\n✅ Populate concluído!`);
  console.log(`─────────────────────────────────────`);
  console.log(`  Base de conhecimento: ${totalBase[0]?.total} tutoriais`);
  console.log(`  Módulos de aulas:     ${totalMod[0]?.total} módulos`);
  console.log(`  Videoaulas:           ${totalAulas[0]?.total} aulas`);
  console.log(`─────────────────────────────────────`);
  console.log(`  Tutoriais: https://ajuda.navivendas.com.br/tutoriais`);
  console.log(`  YouTube:   https://www.youtube.com/@navivendas`);
}

main().catch(e => {
  console.error('\n❌ Erro:', e.response?.data || e.message);
  process.exit(1);
});
