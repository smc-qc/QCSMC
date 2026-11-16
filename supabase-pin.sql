-- QC SMC: เปิดให้ผู้ตรวจจัดการผู้ใช้ (ตั้ง PIN ให้ช่าง) จากในเว็บ
-- วางทั้งหมดใน Supabase > SQL Editor แล้วกด Run ครั้งเดียว

create or replace function public.is_inspector() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members
                where lower(email) = lower(auth.jwt()->>'email') and role = 'inspector')
$$;

drop policy if exists "inspector read members"   on public.members;
drop policy if exists "inspector add members"    on public.members;
drop policy if exists "inspector edit members"   on public.members;
drop policy if exists "inspector remove members" on public.members;
create policy "inspector read members"   on public.members for select to authenticated using (public.is_inspector());
create policy "inspector add members"    on public.members for insert to authenticated with check (public.is_inspector());
create policy "inspector edit members"   on public.members for update to authenticated using (public.is_inspector()) with check (public.is_inspector());
create policy "inspector remove members" on public.members for delete to authenticated using (public.is_inspector());
