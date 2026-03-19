-- Adiciona coluna 'nome' à tabela disparos_campanhas
-- Executar no Supabase SQL Editor

alter table disparos_campanhas
  add column if not exists nome text;
