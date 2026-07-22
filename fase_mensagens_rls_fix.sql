-- Corrige o bug em que uma mensagem marcada como lida continua a aparecer
-- como "nova". Causa provável: a tabela messages tem RLS activo mas falta
-- (ou está demasiado restritiva) uma policy de UPDATE — nesse caso o
-- `update ... set lida_at = now()` corre sem erro (o Supabase não avisa)
-- mas afecta 0 linhas, porque a policy de UPDATE não deixa o perito alterar
-- uma linha cujo remetente é o Admin (e vice-versa). Esta migração garante
-- uma policy de UPDATE explícita e correcta.

-- Policy de UPDATE: o Admin pode marcar como lida qualquer mensagem;
-- o perito só pode marcar como lidas as mensagens da sua própria conversa
-- (perito_id = o seu próprio id), independentemente de quem enviou.
drop policy if exists "mensagens_update" on public.messages;
create policy "mensagens_update"
  on public.messages for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or perito_id = auth.uid()
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or perito_id = auth.uid()
  );

-- Por segurança, confirma também as policies de leitura/escrita (idempotente
-- — só recria se ainda não existirem com este nome exacto).
drop policy if exists "mensagens_select" on public.messages;
create policy "mensagens_select"
  on public.messages for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or perito_id = auth.uid()
  );

drop policy if exists "mensagens_insert" on public.messages;
create policy "mensagens_insert"
  on public.messages for insert
  with check (
    remetente_id = auth.uid()
    and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      or perito_id = auth.uid()
    )
  );
