-- Fix para o módulo de disparos em massa
-- Executar no Supabase SQL Editor

-- 1. Garante coluna nome na tabela de campanhas (caso migration anterior não tenha rodado)
alter table disparos_campanhas
  add column if not exists nome text;

-- 2. Garante unique constraint em disparos_leads para o upsert funcionar corretamente
--    (evita duplicatas de leads por campanha durante o disparo)
alter table disparos_leads
  drop constraint if exists disparos_leads_campanha_lead_unique;

alter table disparos_leads
  add constraint disparos_leads_campanha_lead_unique
  unique (campanha_id, lead_id);
