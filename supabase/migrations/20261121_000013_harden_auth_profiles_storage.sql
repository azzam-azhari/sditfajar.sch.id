-- ==============================================================================
-- MIGRATION 13 - HARDEN AUTH, PROFILES & STORAGE (hasil QA 2026-11-21)
-- 1. Policy UPDATE profiles: hapus cabang self-update (rekursi 42P17 dan
--    membuka kolom sensitif). Semua perubahan profil lewat Server Action.
-- 2. Bucket publik 'images': upload langsung dari client hanya admin/super admin.
-- 3. Tabel login_attempts untuk rate limit login (hanya service role).
-- 4. Normalisasi nomor HP (buang spasi/strip/kurung, +62/62 -> 0) pada data lama.
-- Idempotent: aman dijalankan ulang.
-- ==============================================================================

begin;

-- 1. PROFILES UPDATE ---------------------------------------------------------------
-- is_super_admin() dan is_admin_or_super() adalah security definer, jadi tidak
-- memicu rekursi RLS. User biasa tidak lagi bisa UPDATE profil lewat PostgREST.
drop policy if exists "Profiles update policy" on public.profiles;
drop policy if exists "Profiles admin update policy" on public.profiles;
create policy "Profiles admin update policy"
  on public.profiles for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_or_super() and role <> 'super_admin')
  )
  with check (
    public.is_super_admin()
    or (public.is_admin_or_super() and role <> 'super_admin')
  );

-- 2. STORAGE: bucket images -----------------------------------------------------
drop policy if exists "Authenticated Upload for Images" on storage.objects;
drop policy if exists "Staff upload images" on storage.objects;
create policy "Staff upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'images' and public.is_admin_or_super());

-- 3. LOGIN ATTEMPTS (rate limit) ------------------------------------------------
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  attempt_key text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_key_time
  on public.login_attempts(attempt_key, attempted_at desc);

-- RLS aktif tanpa policy: hanya service role (Server Action login) yang bisa akses.
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

-- 4. NORMALISASI NOMOR HP ----------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p is null then null
    when regexp_replace(p, '[[:space:]().-]', '', 'g') like '+62%'
      then '0' || substr(regexp_replace(p, '[[:space:]().-]', '', 'g'), 4)
    when regexp_replace(p, '[[:space:]().-]', '', 'g') ~ '^62[0-9]{8,}$'
      then '0' || substr(regexp_replace(p, '[[:space:]().-]', '', 'g'), 3)
    else regexp_replace(p, '[[:space:]().-]', '', 'g')
  end;
$$;

update public.profiles
set phone = public.normalize_phone(phone)
where phone is not null and phone <> public.normalize_phone(phone);

-- login_identifier wali murid = nomor HP. Gagal (unique violation) jika dua akun
-- menjadi nomor yang sama; seluruh migration dibatalkan dan perlu dicek manual.
update public.profiles
set login_identifier = public.normalize_phone(login_identifier)
where role = 'wali_murid'
  and login_identifier ~ '^[+0-9][0-9[:space:]().-]+$'
  and login_identifier <> public.normalize_phone(login_identifier);

update public.student_registration_applications
set parent_phone = public.normalize_phone(parent_phone),
    father_phone = public.normalize_phone(father_phone),
    mother_phone = public.normalize_phone(mother_phone)
where parent_phone <> public.normalize_phone(parent_phone)
   or father_phone is distinct from public.normalize_phone(father_phone)
   or mother_phone is distinct from public.normalize_phone(mother_phone);

commit;
