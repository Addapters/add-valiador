-- Permite anexar documentos a um pedido de cliente (requests), seguindo o
-- mesmo padrão já usado para os documentos de imóvel (property_documents /
-- bucket prev-reports).

create table if not exists public.request_documents (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references public.requests(id) on delete cascade,
  storage_path text not null,
  name         text not null,
  size_bytes   integer,
  created_at   timestamptz default now()
);

-- IMPORTANTE: cria o bucket manualmente no dashboard do Supabase antes de
-- correr as políticas abaixo:
--   Storage → New bucket → nome: request-documents → Public
-- (Público para simplificar o acesso aos links de download, tal como o
-- bucket "prev-reports" já usado para os documentos de imóvel.)
do $$
begin
  if not exists (select 1 from pg_policies where policyname='request_documents_insert' and tablename='objects') then
    execute 'create policy request_documents_insert on storage.objects for insert with check (bucket_id = ''request-documents'')';
  end if;
  if not exists (select 1 from pg_policies where policyname='request_documents_select' and tablename='objects') then
    execute 'create policy request_documents_select on storage.objects for select using (bucket_id = ''request-documents'')';
  end if;
  if not exists (select 1 from pg_policies where policyname='request_documents_delete' and tablename='objects') then
    execute 'create policy request_documents_delete on storage.objects for delete using (bucket_id = ''request-documents'')';
  end if;
end $$;
