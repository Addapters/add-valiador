-- Passa a permitir associar client_id na criação de utilizadores, para que
-- se possa criar o login de um Cliente já ligado à respectiva entidade,
-- directamente a partir da tab Clientes (sem passo manual de SQL a seguir).
--
-- A função antiga (4 argumentos) é substituída por esta versão (5 argumentos,
-- o novo é opcional) — por isso é preciso apagar a antiga primeiro, para não
-- ficarem duas versões ambíguas com o mesmo nome.

drop function if exists public.admin_create_user(text, text, text, text);

create or replace function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_name      text,
  p_role      text default 'perito',
  p_client_id uuid default null
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

  if p_role = 'cliente' and p_client_id is null then
    raise exception 'utilizadores de cliente têm de estar associados a um client_id';
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

  insert into public.profiles (id, name, role, client_id)
  values (v_user_id, p_name, p_role, p_client_id)
  on conflict (id) do update set name = excluded.name, role = excluded.role, client_id = excluded.client_id;

  return v_user_id;
end;
$$;

grant execute on function public.admin_create_user(text, text, text, text, uuid) to authenticated;
