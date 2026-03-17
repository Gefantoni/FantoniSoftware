-- =====================================================
-- CENTRAL DO NEGÓCIO — Schema do Banco de Dados
-- Execute no SQL Editor do Supabase
-- =====================================================

-- Perfis de usuário
CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  plano TEXT NOT NULL DEFAULT 'basico' CHECK (plano IN ('basico','profissional','premium')),
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente','suporte','financeiro','comercial','admin')),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Trigger: cria perfil automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION criar_perfil_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfis (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION criar_perfil_usuario();

-- Módulos de videoaulas
CREATE TABLE IF NOT EXISTS modulos (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  plano_minimo TEXT NOT NULL DEFAULT 'basico' CHECK (plano_minimo IN ('basico','profissional','premium')),
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Videoaulas
CREATE TABLE IF NOT EXISTS videoaulas (
  id SERIAL PRIMARY KEY,
  modulo_id INTEGER REFERENCES modulos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  url_video TEXT NOT NULL,
  thumb_url TEXT,
  duracao_seg INTEGER DEFAULT 0,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Base de conhecimento da IA
CREATE TABLE IF NOT EXISTS base_conhecimento (
  id SERIAL PRIMARY KEY,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  url_video TEXT,
  tags TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Progresso nas aulas
CREATE TABLE IF NOT EXISTS progresso (
  id SERIAL PRIMARY KEY,
  cliente_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
  videoaula_id INTEGER REFERENCES videoaulas(id) ON DELETE CASCADE,
  segundos_vistos INTEGER DEFAULT 0,
  concluido BOOLEAN DEFAULT false,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, videoaula_id)
);

-- Tickets de suporte
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  cliente_id UUID REFERENCES perfis(id),
  atendente_id UUID REFERENCES perfis(id),
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('suporte','financeiro','comercial')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','urgente')),
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','aceito','em_andamento','resolvido')),
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Mensagens do chat em tempo real
CREATE TABLE IF NOT EXISTS mensagens_ticket (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES perfis(id),
  tipo TEXT DEFAULT 'texto' CHECK (tipo IN ('texto','imagem','audio')),
  conteudo TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Financeiro pessoal do cliente
CREATE TABLE IF NOT EXISTS financeiro_cliente (
  id SERIAL PRIMARY KEY,
  cliente_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  faturamento NUMERIC(12,2) DEFAULT 0,
  custos NUMERIC(12,2) DEFAULT 0,
  margem_lucro NUMERIC(5,2),
  meta NUMERIC(12,2),
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, mes, ano)
);

-- Metas padrão por mês de uso
CREATE TABLE IF NOT EXISTS metas_padrao (
  mes_de_uso INTEGER PRIMARY KEY,
  valor NUMERIC(12,2) NOT NULL
);
INSERT INTO metas_padrao VALUES (1, 4000), (2, 6000), (3, 8000) ON CONFLICT DO NOTHING;

-- Financeiro da empresa
CREATE TABLE IF NOT EXISTS lancamentos (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  recorrente BOOLEAN DEFAULT false,
  periodicidade TEXT CHECK (periodicidade IN ('mensal','anual','unico')),
  cliente_id UUID REFERENCES perfis(id),
  asaas_cobranca_id TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  vencimento DATE,
  pago_em DATE,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Leads do comercial
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  nome TEXT,
  whatsapp TEXT NOT NULL,
  origem TEXT,
  status TEXT DEFAULT 'novo' CHECK (status IN ('novo','qualificado','convertido','perdido')),
  responsavel_id UUID REFERENCES perfis(id),
  chatwoot_contact_id TEXT,
  notas TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Histórico SDR
CREATE TABLE IF NOT EXISTS sdr_conversas (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  mensagem_lead TEXT NOT NULL,
  resposta_ia TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE videoaulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_conhecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_conversas ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (service key bypassa tudo — o backend usa service key)
-- Aqui definimos para uso direto do anon key se necessário
CREATE POLICY "perfis_proprio" ON perfis FOR ALL USING (auth.uid() = id);
CREATE POLICY "progresso_proprio" ON progresso FOR ALL USING (auth.uid() = cliente_id);
CREATE POLICY "financeiro_proprio" ON financeiro_cliente FOR ALL USING (auth.uid() = cliente_id);
CREATE POLICY "tickets_cliente" ON tickets FOR SELECT USING (auth.uid() = cliente_id);
CREATE POLICY "mensagens_acesso" ON mensagens_ticket FOR SELECT USING (
  EXISTS (SELECT 1 FROM tickets WHERE id = ticket_id AND (cliente_id = auth.uid() OR atendente_id = auth.uid()))
);
CREATE POLICY "modulos_leitura" ON modulos FOR SELECT USING (ativo = true);
CREATE POLICY "videoaulas_leitura" ON videoaulas FOR SELECT USING (ativo = true);
CREATE POLICY "base_leitura" ON base_conhecimento FOR SELECT USING (ativo = true);

-- Habilita Realtime nas tabelas de chat
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens_ticket;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
