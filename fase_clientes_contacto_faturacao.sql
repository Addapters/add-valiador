-- Campos adicionais na entidade cliente: pessoa de contacto e informação de
-- faturação. O cliente pode preencher/actualizar estes campos no seu perfil;
-- o admin vê-os na tab Clientes para saber que dados usar ao faturar.

alter table public.clients
  add column if not exists contact_name  text,
  add column if not exists contact_role  text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists billing_email   text,
  add column if not exists billing_nif     text,
  add column if not exists billing_address text,
  add column if not exists billing_notes   text;

-- Permite ao cliente actualizar a sua própria entidade (contacto/faturação).
-- A restrição a quais campos são editáveis é feita na interface — a policy
-- em si é ao nível da linha, não da coluna.
drop policy if exists "cliente_actualiza_a_sua_entidade" on public.clients;
create policy "cliente_actualiza_a_sua_entidade"
  on public.clients for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'cliente' and p.client_id = clients.id
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'cliente' and p.client_id = clients.id
  ));

-- Tipo de pedido: passa a admitir "outro", além de ad_hoc/carteira.
alter table public.requests drop constraint if exists requests_tipo_check;
alter table public.requests add constraint requests_tipo_check check (tipo in ('ad_hoc','carteira','outro'));
