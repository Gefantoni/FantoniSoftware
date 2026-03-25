-- ============================================================
-- FANTONI PDV — Setup das tabelas no Supabase
-- Execute no painel: supabase.com → SQL Editor → New query
-- Seguro: não apaga dados existentes
-- ============================================================


-- ── TABELA: leads (período teste) ────────────────────────────

create table if not exists leads (
  id          bigint generated always as identity primary key,
  name        text,
  email       text,
  whatsapp    text,
  cpf_cnpj    text,
  origem      text,
  created_at  timestamptz not null default now()
);

alter table leads add column if not exists name       text;
alter table leads add column if not exists email      text;
alter table leads add column if not exists whatsapp   text;
alter table leads add column if not exists cpf_cnpj   text;
alter table leads add column if not exists origem      text;
alter table leads add column if not exists created_at timestamptz default now();

create index if not exists leads_email_idx on leads (email);

alter table leads enable row level security;

drop policy if exists "service only" on leads;
create policy "service only" on leads
  for all
  to service_role
  using (true)
  with check (true);


-- ── TABELA: checkouts (pagamentos) ───────────────────────────

create table if not exists checkouts (
  id          bigint generated always as identity primary key,
  name        text,
  email       text,
  cpf_cnpj    text,
  plan        text,
  plan_label  text,
  plan_value  numeric(10,2),
  order_bump  boolean     default false,
  total_value numeric(10,2),
  asaas_id    text,
  customer_id text,
  invoice_url text,
  status      text        default 'pending',
  origem      text,
  created_at  timestamptz not null default now()
);

alter table checkouts add column if not exists name        text;
alter table checkouts add column if not exists email       text;
alter table checkouts add column if not exists cpf_cnpj    text;
alter table checkouts add column if not exists plan        text;
alter table checkouts add column if not exists plan_label  text;
alter table checkouts add column if not exists plan_value  numeric(10,2);
alter table checkouts add column if not exists order_bump  boolean default false;
alter table checkouts add column if not exists total_value numeric(10,2);
alter table checkouts add column if not exists asaas_id    text;
alter table checkouts add column if not exists customer_id text;
alter table checkouts add column if not exists invoice_url text;
alter table checkouts add column if not exists status      text default 'pending';
alter table checkouts add column if not exists origem      text;
alter table checkouts add column if not exists created_at  timestamptz default now();

create index if not exists checkouts_email_idx  on checkouts (email);
create index if not exists checkouts_status_idx on checkouts (status);

alter table checkouts enable row level security;

drop policy if exists "service only" on checkouts;
create policy "service only" on checkouts
  for all
  to service_role
  using (true)
  with check (true);
