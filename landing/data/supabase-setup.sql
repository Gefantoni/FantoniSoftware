-- ============================================================
-- FANTONI PDV — Setup das tabelas no Supabase
-- Execute no painel: supabase.com → SQL Editor → New query
-- ============================================================


-- ── TABELA: leads ────────────────────────────────────────────
-- Captura do formulário "Testar 7 dias grátis"

create table if not exists leads (
  id          bigint generated always as identity primary key,
  name        text        not null,
  email       text        not null,
  whatsapp    text        not null,
  cpf_cnpj    text,
  created_at  timestamptz not null default now()
);

create index if not exists leads_email_idx on leads (email);

alter table leads enable row level security;

create policy "service only" on leads
  for all
  using (auth.role() = 'service_role');


-- ── TABELA: checkouts ────────────────────────────────────────
-- Registra cada tentativa de assinatura via Asaas

create table if not exists checkouts (
  id          bigint generated always as identity primary key,

  -- Dados do cliente
  name        text        not null,
  email       text        not null,
  cpf_cnpj    text,

  -- Plano escolhido
  plan        text        not null,   -- 'mei' | 'essencial' | 'premium'
  plan_label  text,                   -- 'MEI' | 'Essencial' | 'Premium'
  plan_value  numeric(10,2),          -- valor mensal do plano
  order_bump  boolean     default false,
  total_value numeric(10,2),          -- valor cobrado na primeira fatura

  -- Dados do Asaas
  asaas_id    text,                   -- ID da cobrança ou assinatura
  customer_id text,                   -- ID do cliente no Asaas
  invoice_url text,                   -- link de pagamento gerado
  status      text        default 'pending',  -- pending | paid | cancelled

  created_at  timestamptz not null default now()
);

create index if not exists checkouts_email_idx  on checkouts (email);
create index if not exists checkouts_status_idx on checkouts (status);

alter table checkouts enable row level security;

create policy "service only" on checkouts
  for all
  using (auth.role() = 'service_role');
