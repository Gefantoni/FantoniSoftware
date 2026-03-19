-- Garante colunas da tabela campanhas que podem estar faltando
-- Executar no Supabase SQL Editor

alter table campanhas
  add column if not exists mensagem text;

alter table campanhas
  add column if not exists tipo_fluxo text default 'unico';

alter table campanhas
  add column if not exists origem text;

alter table campanhas
  add column if not exists tags text[] default '{}';

alter table campanhas
  add column if not exists total_enviados integer default 0;

alter table campanhas
  add column if not exists total_entregas integer default 0;

alter table campanhas
  add column if not exists total_falhas integer default 0;

alter table campanhas
  add column if not exists total_respostas integer default 0;

alter table campanhas
  add column if not exists total_interesse integer default 0;

alter table campanhas
  add column if not exists total_oportunidades integer default 0;

alter table campanhas
  add column if not exists total_reunioes integer default 0;

alter table campanhas
  add column if not exists atualizado_em timestamptz default now();
