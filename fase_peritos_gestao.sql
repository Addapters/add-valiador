-- Gestão de Peritos Avaliadores
-- Campos adicionais em profiles necessários para a nova área de admin
-- (N.º CMVM, Seguradora, Assinatura). Os campos "Apólice N.º" e "Data de
-- Validade" já existem (seguro_rc_apolice / seguro_rc_validade, de
-- fase4_perfil_perito.sql) — não são recriados aqui.

alter table public.profiles
  add column if not exists numero_cmvm    text,
  add column if not exists seguradora     text,
  add column if not exists assinatura_path text;

-- Bucket de armazenamento para as imagens de assinatura dos peritos.
-- IMPORTANTE: cria o bucket manualmente no dashboard do Supabase antes de
-- correr as políticas abaixo:
--   Storage → New bucket → nome: perito-assinaturas → Private
--
-- Estrutura de path usada pela app: {perito_id}/assinatura.<ext>

drop policy if exists "admin_full_access_assinaturas" on storage.objects;
create policy "admin_full_access_assinaturas"
  on storage.objects for all
  using (
    bucket_id = 'perito-assinaturas'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    bucket_id = 'perito-assinaturas'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "perito_gere_a_sua_assinatura" on storage.objects;
create policy "perito_gere_a_sua_assinatura"
  on storage.objects for all
  using (
    bucket_id = 'perito-assinaturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'perito-assinaturas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Criação de novos utilizadores directamente a partir da app (sem terminal
-- nem Edge Functions). Segue o mesmo princípio já usado para repor passwords
-- (pgcrypto crypt()/gen_salt()), mas encapsulado numa função SECURITY DEFINER
-- que só pode ser chamada por quem já é admin.
create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_name     text,
  p_role     text default 'perito'
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'apenas administradores podem criar utilizadores';
  end if;

  if p_role not in ('admin','perito','cliente') then
    raise exception 'role inválido: %', p_role;
  end if;

  if exists (select 1 from auth.users where email = p_email) then
    raise exception 'já existe um utilizador com este email';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name),
    false, now(), now()
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, name, role)
  values (v_user_id, p_name, p_role)
  on conflict (id) do update set name = excluded.name, role = excluded.role;

  return v_user_id;
end;
$$;

grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
