-- ============================================================
-- Migration: Tabela sdr_midias
-- Armazena as mídias vinculadas às tags do agente SDR (Lara)
-- Ex: [SEND_VIDEO_DEMO], [SEND_FOTO_IMPRESSORA], etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS sdr_midias (
  id           SERIAL PRIMARY KEY,
  agente_id    INTEGER NOT NULL REFERENCES agentes_ia_comercial(id) ON DELETE CASCADE,
  tag          TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'link',
  url          TEXT,
  caption      TEXT,
  filename     TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em    TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agente_id, tag),
  CONSTRAINT tag_valida CHECK (tag IN ('SEND_VIDEO_DEMO','SEND_FOTO_IMPRESSORA','SEND_AUDIO_PROVA','SEND_CARDAPIO_DEMO','SEND_LINK_TESTE')),
  CONSTRAINT tipo_valido CHECK (tipo IN ('link','video','imagem','audio','documento'))
);

CREATE INDEX IF NOT EXISTS idx_sdr_midias_agente_ativo ON sdr_midias (agente_id, ativo) WHERE ativo = TRUE;

GRANT ALL ON TABLE sdr_midias TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE sdr_midias_id_seq TO anon, authenticated, service_role;

ALTER TABLE sdr_midias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sdr_midias' AND policyname='sdr_midias_admin') THEN
    CREATE POLICY sdr_midias_admin ON sdr_midias USING (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin','comercial')));
  END IF;
END $$;
