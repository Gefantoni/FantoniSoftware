-- ================================================================
-- Módulo de Disparos em Massa (WhatsApp + Email)
-- Executar no Supabase SQL Editor
-- ================================================================

-- Campanhas de disparo
create table if not exists disparos_campanhas (
  id            uuid primary key default gen_random_uuid(),
  canal         text not null,            -- whatsapp | email | ambos
  status        text default 'ativo',     -- ativo | pausado | concluido | encerrado
  total         integer default 0,
  enviados      integer default 0,
  erros         integer default 0,
  config        jsonb,
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Leads de cada campanha
create table if not exists disparos_leads (
  id            uuid primary key default gen_random_uuid(),
  campanha_id   uuid references disparos_campanhas(id) on delete cascade,
  lead_id       text,
  nome          text,
  email         text,
  telefone      text,
  status        text default 'aguardando', -- aguardando | enviado_wa | enviado_email | parcial | erro_wa | erro_email
  erro          text,
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Índices para performance
create index if not exists idx_disparos_leads_campanha on disparos_leads(campanha_id);
create index if not exists idx_disparos_campanhas_status on disparos_campanhas(status);

-- Função para incrementar enviados atomicamente (chamada após cada envio bem-sucedido)
create or replace function disparos_incrementar_enviados(p_id uuid)
returns void language sql as $$
  update disparos_campanhas
  set enviados = enviados + 1,
      atualizado_em = now()
  where id = p_id;
$$;

-- RLS (Row Level Security) — acesso apenas pelo service role (backend)
alter table disparos_campanhas enable row level security;
alter table disparos_leads     enable row level security;

-- Sem políticas públicas: apenas o supabaseAdmin (service_role) acessa
-- O backend usa a chave service_role, então não precisa de policy adicional
