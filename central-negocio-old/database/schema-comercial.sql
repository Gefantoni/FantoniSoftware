-- =====================================================
-- CENTRAL DO NEGÓCIO — Módulo Comercial (migração)
-- Execute no SQL Editor do Supabase APÓS o schema principal
-- =====================================================

-- ---- Expand tabela leads ----
ALTER TABLE leads ADD COLUMN IF NOT EXISTS empresa TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS segmento TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_interacao TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interesse_detectado BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS no_kanban BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instancia TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campanha_id INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ---- Instâncias WhatsApp ----
CREATE TABLE IF NOT EXISTS instancias_whatsapp (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  numero TEXT,
  status TEXT DEFAULT 'inativo' CHECK (status IN ('ativo','inativo','conectando')),
  agente_id INTEGER,
  apikey TEXT,
  instancia_evo TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- Agentes IA Comercial ----
CREATE TABLE IF NOT EXISTS agentes_ia_comercial (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  instancia TEXT,
  ativo BOOLEAN DEFAULT true,
  funcao TEXT,
  objetivo TEXT,
  nicho TEXT,
  descricao_operacional TEXT,
  system_prompt TEXT,
  instrucoes_complementares TEXT,
  regras_negativas TEXT,
  exemplos_comportamento TEXT,
  tom_voz TEXT DEFAULT 'consultivo' CHECK (tom_voz IN ('consultivo','direto','formal','humano','comercial','tecnico')),
  tamanho_resposta TEXT DEFAULT 'medio' CHECK (tamanho_resposta IN ('curto','medio','longo')),
  usar_emoji BOOLEAN DEFAULT false,
  pode_falar_preco BOOLEAN DEFAULT false,
  situacoes_preco TEXT,
  objetivo_conversa TEXT,
  quando_insistir TEXT,
  quando_parar TEXT,
  quando_chamar_humano TEXT,
  quando_criar_oportunidade TEXT,
  quando_mover_kanban TEXT,
  quando_agendar TEXT,
  criterios_dor TEXT,
  criterios_interesse TEXT,
  regra_followup TEXT,
  regra_perda TEXT,
  pode_responder_sozinha BOOLEAN DEFAULT true,
  pode_mover_lead BOOLEAN DEFAULT false,
  pode_agendar BOOLEAN DEFAULT false,
  pode_encerrar_conversa BOOLEAN DEFAULT false,
  pode_pausar_followup BOOLEAN DEFAULT false,
  pode_marcar_interesse BOOLEAN DEFAULT true,
  provider TEXT DEFAULT 'openai' CHECK (provider IN ('openai', 'gemini')),
  api_key TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- FK para instancias
ALTER TABLE instancias_whatsapp ADD CONSTRAINT fk_instancia_agente
  FOREIGN KEY (agente_id) REFERENCES agentes_ia_comercial(id) ON DELETE SET NULL;

-- ---- Campanhas ----
CREATE TABLE IF NOT EXISTS campanhas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  instancia TEXT,
  agente_id INTEGER REFERENCES agentes_ia_comercial(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativa','pausada','encerrada')),
  mensagem TEXT,
  tipo_fluxo TEXT DEFAULT 'unico' CHECK (tipo_fluxo IN ('unico','followup_resposta','followup_interesse')),
  origem TEXT,
  tags TEXT[] DEFAULT '{}',
  total_enviados INTEGER DEFAULT 0,
  total_entregas INTEGER DEFAULT 0,
  total_falhas INTEGER DEFAULT 0,
  total_respostas INTEGER DEFAULT 0,
  total_interesse INTEGER DEFAULT 0,
  total_oportunidades INTEGER DEFAULT 0,
  total_reunioes INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- Leads vinculados a campanhas ----
CREATE TABLE IF NOT EXISTS campanha_leads (
  id SERIAL PRIMARY KEY,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','entregue','falha','respondeu','interesse')),
  enviado_em TIMESTAMPTZ,
  respondeu_em TIMESTAMPTZ,
  UNIQUE(campanha_id, lead_id)
);

-- ---- Oportunidades (Kanban) ----
CREATE TABLE IF NOT EXISTS oportunidades (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  etapa TEXT DEFAULT 'novo_interesse' CHECK (etapa IN (
    'novo_interesse','qualificando','qualificado',
    'reuniao_agendada','proposta','negociacao','fechado','perdido'
  )),
  temperatura TEXT DEFAULT 'morno' CHECK (temperatura IN ('frio','morno','quente')),
  score INTEGER DEFAULT 0,
  resumo_ia TEXT,
  proxima_acao TEXT,
  responsavel_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  motivo_qualificacao TEXT,
  valor_estimado NUMERIC(12,2),
  motivo_perda TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- Histórico de movimentações Kanban ----
CREATE TABLE IF NOT EXISTS oportunidades_movimentacoes (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER REFERENCES oportunidades(id) ON DELETE CASCADE,
  etapa_anterior TEXT,
  etapa_nova TEXT NOT NULL,
  observacao TEXT,
  autor_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- Reuniões / Calendário ----
CREATE TABLE IF NOT EXISTS reunioes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  oportunidade_id INTEGER REFERENCES oportunidades(id) ON DELETE SET NULL,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_min INTEGER DEFAULT 60,
  status TEXT DEFAULT 'agendada' CHECK (status IN ('agendada','concluida','cancelada','reagendada')),
  observacoes TEXT,
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual','ia','campanha')),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- Tags comerciais ----
CREATE TABLE IF NOT EXISTS tags_comercial (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT '#2563eb',
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- Feed de atividade comercial ----
CREATE TABLE IF NOT EXISTS atividades_comercial (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  oportunidade_id INTEGER REFERENCES oportunidades(id) ON DELETE SET NULL,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE SET NULL,
  reuniao_id INTEGER REFERENCES reunioes(id) ON DELETE SET NULL,
  autor_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ---- RLS ----
ALTER TABLE instancias_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentes_ia_comercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags_comercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades_comercial ENABLE ROW LEVEL SECURITY;

-- Seed: 3 instâncias padrão
INSERT INTO instancias_whatsapp (nome, numero, status) VALUES
  ('Instância 1', '', 'inativo'),
  ('Instância 2', '', 'inativo'),
  ('Instância 3', '', 'inativo')
ON CONFLICT DO NOTHING;

-- Seed: tags iniciais
INSERT INTO tags_comercial (nome, cor) VALUES
  ('VIP', '#c8a96e'),
  ('Urgente', '#ef4444'),
  ('Retornar', '#f59e0b'),
  ('Parceiro', '#10b981')
ON CONFLICT DO NOTHING;
