-- ============================================================
-- Add-valiador — Schema inicial
-- Aplicar via: supabase db push  ou  supabase migration up
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";   -- georreferenciação

-- ------------------------------------------------------------
-- CLIENTES (empresas que encomendam avaliações)
-- ------------------------------------------------------------
create table public.clients (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  nif         text,
  email       text,
  phone       text,
  address     text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- TEMPLATES EXCEL por cliente
-- ------------------------------------------------------------
create table public.client_templates (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid references public.clients(id) on delete cascade,
  name            text not null,
  file_path       text,          -- path no Supabase Storage
  field_map       jsonb,         -- mapeamento coluna data-tape → célula Excel
  photo_config    jsonb,         -- config de fotos: tamanho, células destino, etc.
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ------------------------------------------------------------
-- PORTFÓLIOS (conjunto de imóveis de um cliente / mandato)
-- ------------------------------------------------------------
create table public.portfolios (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid references public.clients(id) on delete cascade,
  name        text not null,
  description text,
  deadline    date,
  status      text default 'active' check (status in ('active','completed','archived')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- IMÓVEIS
-- ------------------------------------------------------------
create table public.properties (
  id                  uuid primary key default uuid_generate_v4(),
  portfolio_id        uuid references public.portfolios(id) on delete cascade,
  client_id           uuid references public.clients(id),
  ref                 text not null,                 -- referência interna ex: AV-0341
  external_ref        text,                          -- ref do cliente na data-tape
  -- localização
  address             text,
  parish              text,
  municipality        text,
  district            text,
  postal_code         text,
  coordinates         geometry(Point, 4326),         -- PostGIS
  -- características
  property_type       text,                          -- Apartamento, Moradia, Terreno, Comércio…
  typology            text,                          -- T0, T1, T2, T3…
  gross_area          numeric,
  useful_area         numeric,
  land_area           numeric,
  floor               integer,
  year_built          integer,
  condition           text,
  -- dados data-tape (jsonb para flexibilidade entre clientes)
  datatape_data       jsonb default '{}',
  -- estados
  visit_status        text default 'pending'
                        check (visit_status in ('pending','scheduled','visited','report_done')),
  visit_date          date,
  visit_notes         text,
  -- financeiro
  billing_status      text default 'no_po'
                        check (billing_status in ('no_po','awaiting_po','po_received','invoice_pending','invoice_issued','paid')),
  fee_amount          numeric,
  po_number           text,
  po_date             date,
  invoice_number      text,
  invoice_date        date,
  payment_date        date,
  -- report
  report_path         text,                          -- path no Storage
  report_generated_at timestamptz,
  -- meta
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- índices úteis
create index on public.properties (portfolio_id);
create index on public.properties (client_id);
create index on public.properties (visit_status);
create index on public.properties (billing_status);
create index on public.properties using gist (coordinates);

-- ------------------------------------------------------------
-- FOTOS
-- ------------------------------------------------------------
create table public.property_photos (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid references public.properties(id) on delete cascade,
  storage_path  text not null,
  original_name text,
  size_bytes    integer,
  width         integer,
  height        integer,
  taken_at      timestamptz,
  sort_order    integer default 0,
  caption       text,
  created_at    timestamptz default now()
);

create index on public.property_photos (property_id);

-- ------------------------------------------------------------
-- PROSPEÇÃO DE MERCADO (comparáveis)
-- ------------------------------------------------------------
create table public.market_comps (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid references public.properties(id) on delete cascade,
  portal        text not null,          -- Idealista, Imovirtual, CasaSapo, …
  listing_ref   text,
  url           text,
  address       text,
  typology      text,
  area_m2       numeric,
  price         numeric,
  price_per_m2  numeric generated always as (
                  case when area_m2 > 0 then round(price / area_m2, 0) else null end
                ) stored,
  listing_date  date,
  is_sold       boolean default false,
  notes         text,
  created_at    timestamptz default now()
);

create index on public.market_comps (property_id);

-- ------------------------------------------------------------
-- DATA-TAPE IMPORTS (histórico de uploads)
-- ------------------------------------------------------------
create table public.datatape_imports (
  id              uuid primary key default uuid_generate_v4(),
  portfolio_id    uuid references public.portfolios(id) on delete cascade,
  file_name       text,
  storage_path    text,
  row_count       integer,
  imported_count  integer,
  errors          jsonb,
  imported_by     uuid,
  created_at      timestamptz default now()
);

-- ------------------------------------------------------------
-- FUNÇÕES UTILITÁRIAS
-- ------------------------------------------------------------

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger trg_portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

create trigger trg_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- (activar após configurar Auth; por agora permite acesso autenticado total)
-- ------------------------------------------------------------
alter table public.clients           enable row level security;
alter table public.client_templates  enable row level security;
alter table public.portfolios        enable row level security;
alter table public.properties        enable row level security;
alter table public.property_photos   enable row level security;
alter table public.market_comps      enable row level security;
alter table public.datatape_imports  enable row level security;

-- Política permissiva para utilizadores autenticados (fase MVP)
-- Substituir por políticas por organização quando necessário
create policy "authenticated full access" on public.clients
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.client_templates
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.portfolios
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.properties
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.property_photos
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.market_comps
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.datatape_imports
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- STORAGE BUCKETS (criar manualmente no dashboard Supabase)
-- ------------------------------------------------------------
-- Bucket: "templates"   → templates Excel dos clientes
-- Bucket: "reports"     → reports gerados
-- Bucket: "photos"      → fotos dos imóveis (max 1MB após compressão)
-- Bucket: "datatapes"   → ficheiros data-tape originais
--
-- Política sugerida para "photos":
--   INSERT/SELECT para authenticated
--   max file size: 1048576 (1MB)
--   allowed types: image/jpeg, image/png, image/webp
