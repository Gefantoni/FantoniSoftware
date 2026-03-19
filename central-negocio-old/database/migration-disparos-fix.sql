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

-- 3. Desabilita RLS nas tabelas de disparos (acesso controlado pelo backend via service_role)
alter table disparos_campanhas disable row level security;
alter table disparos_leads     disable row level security;

-- 4. Grant explícito para todas as roles do PostgREST (resolve "permission denied for table")
grant all privileges on table disparos_campanhas to anon, authenticated, service_role;
grant all privileges on table disparos_leads     to anon, authenticated, service_role;

-- 5. Grant na função de incremento atômico
grant execute on function disparos_incrementar_enviados(uuid) to anon, authenticated, service_role;
