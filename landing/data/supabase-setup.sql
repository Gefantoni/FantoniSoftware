-- ============================================================
-- FANTONI PDV — Setup das tabelas no Supabase
-- Execute no painel: supabase.com → SQL Editor → New query
-- ============================================================

-- ── Remove tabelas antigas se existirem ──────────────────────
drop table if exists checkouts cascade;
drop table if exists leads     cascade;


-- ── TABELA: leads ────────────────────────────────────────────
-- Captura do formulário "Testar 7 dias grátis"

create table leads (
  id          bigint generated always as identity primary key,
  name        text        not null,
  email       text        not null,
  whatsapp    text        not null,
  cpf_cnpj    text,
  created_at  timestamptz not null default now()
);

create index leads_email_idx on leads (email);

alter table leads enable row level security;

create policy "service only" on leads
  for all
  using (auth.role() = 'service_role');


-- ── TABELA: checkouts ────────────────────────────────────────
-- Registra cada tentativa de assinatura via Asaas

create table checkouts (
  id          bigint generated always as identity primary key,

  -- Dados do cliente
  name        text        not null,
  email       text        not null,
  cpf_cnpj    text,

  -- Plano escolhido
  plan        text        not null,
  plan_label  text,
  plan_value  numeric(10,2),
  order_bump  boolean     default false,
  total_value numeric(10,2),

  -- Dados do Asaas
  asaas_id    text,
  customer_id text,
  invoice_url text,
  status      text        default 'pending',

  created_at  timestamptz not null default now()
);

create index checkouts_email_idx  on checkouts (email);
create index checkouts_status_idx on checkouts (status);

alter table checkouts enable row level security;

create policy "service only" on checkouts
  for all
  using (auth.role() = 'service_role');
