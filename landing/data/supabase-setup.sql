-- ============================================================
-- FANTONI PDV — Setup da tabela de leads no Supabase
-- Execute no painel: supabase.com → SQL Editor → New query
-- ============================================================

create table if not exists leads (
  id          bigint generated always as identity primary key,
  name        text        not null,
  email       text        not null,
  whatsapp    text        not null,
  cpf_cnpj    text,
  created_at  timestamptz not null default now()
);

-- Índice para buscas por email
create index if not exists leads_email_idx on leads (email);

-- Habilita Row Level Security (RLS)
alter table leads enable row level security;

-- Apenas o service_role (backend) pode inserir e ler
-- Nenhum acesso anônimo pelo client-side
create policy "service only" on leads
  for all
  using (auth.role() = 'service_role');
