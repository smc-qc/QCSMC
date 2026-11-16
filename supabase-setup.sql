-- QC SMC: ตั้งค่าฐานข้อมูล (วางทั้งหมดใน Supabase > SQL Editor แล้วกด Run ครั้งเดียว)
-- ก่อนกด Run: แก้อีเมลบรรทัดล่างสุดเป็นอีเมลของคุณ

create table if not exists public.inspections(
  id text primary key,
  data jsonb not null,
  updated_at bigint not null default 0,
  updated_by uuid default auth.uid()
);
create table if not exists public.members(
  email text primary key,
  name text,
  role text not null default 'tech'   -- 'tech' = ช่าง, 'inspector' = ผู้ตรวจ
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.members where lower(email) = lower(auth.jwt()->>'email'))
$$;

alter table public.inspections enable row level security;
alter table public.members enable row level security;

drop policy if exists "member read"   on public.inspections;
drop policy if exists "member insert" on public.inspections;
drop policy if exists "member update" on public.inspections;
drop policy if exists "member delete" on public.inspections;
create policy "member read"   on public.inspections for select to authenticated using (public.is_member());
create policy "member insert" on public.inspections for insert to authenticated with check (public.is_member());
create policy "member update" on public.inspections for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "member delete" on public.inspections for delete to authenticated using (public.is_member());

drop policy if exists "see own membership" on public.members;
create policy "see own membership" on public.members for select to authenticated
  using (lower(email) = lower(auth.jwt()->>'email'));

-- ให้หน้าจอของทุกคนอัปเดตทันทีเมื่อมีคนบันทึก
do $$ begin
  alter publication supabase_realtime add table public.inspections;
exception when duplicate_object then null; end $$;

-- ที่เก็บรูปถ่าย (ชื่อไฟล์เป็นรหัสสุ่ม 32 ตัว เดาไม่ได้)
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;
drop policy if exists "member upload photo" on storage.objects;
create policy "member upload photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());

-- ผู้ใช้คนแรก (คุณ) — แก้อีเมลก่อนกด Run
insert into public.members (email, name, role)
values ('ใส่อีเมลของคุณที่นี่', 'นายณัฐพล ปาสานัย', 'inspector')
on conflict (email) do update set role = excluded.role, name = excluded.name;

-- เพิ่มช่างภายหลัง: Table Editor > members > Insert row (ใส่อีเมลช่าง, role = tech)
-- หรือรันคำสั่งนี้:
-- insert into public.members (email, name) values ('chang@example.com', 'ชื่อช่าง');
