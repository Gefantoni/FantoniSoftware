-- =====================================================
-- MIGRAÇÃO: Permissões de telas por usuário
-- Execute no SQL Editor do Supabase
-- =====================================================

-- Adiciona coluna de permissões de telas (JSONB) na tabela perfis
-- Valor padrão: todas as telas habilitadas
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS permissoes_telas JSONB DEFAULT '{
  "videoaulas": true,
  "agente_ia": true,
  "cardapio_ia": true,
  "financeiro": true,
  "tickets": true,
  "empreendedorismo": true
}'::jsonb;

-- Atualiza registros existentes que ainda não têm permissões
UPDATE perfis
SET permissoes_telas = '{
  "videoaulas": true,
  "agente_ia": true,
  "cardapio_ia": true,
  "financeiro": true,
  "tickets": true,
  "empreendedorismo": true
}'::jsonb
WHERE permissoes_telas IS NULL;
