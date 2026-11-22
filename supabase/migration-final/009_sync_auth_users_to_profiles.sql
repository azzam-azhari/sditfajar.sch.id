-- ==============================================================================
-- 009 - SINKRON OTOMATIS AKUN AUTH DASHBOARD -> PUBLIC.PROFILES
-- Akun yang dibuat lewat Supabase Dashboard (Authentication -> Add user) otomatis
-- mendapat baris profiles dengan role super_admin.
-- Akun yang dibuat aplikasi (super admin, terima SPMB, import CSV) selalu membawa
-- user_metadata.role dan aplikasinya sendiri yang mengisi profiles, jadi dilewati
-- di sini agar tidak bentrok primary key.
-- Idempotent.
-- ==============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Dibuat oleh aplikasi: profil diisi oleh Server Action / import_csv_batch.
  if coalesce(new.raw_user_meta_data, '{}'::jsonb) ? 'role' then
    return new;
  end if;

  insert into public.profiles (id, name, email, login_identifier, role, phone, is_active, must_change_password)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(coalesce(new.email, new.phone, 'Super Admin'), '@', 1)),
    new.email,
    lower(coalesce(new.email, public.normalize_phone(nullif(new.phone, '')), new.id::text)),
    'super_admin',
    public.normalize_phone(nullif(new.phone, '')),
    true,
    false -- password ditetapkan sendiri saat Add user di dashboard
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill: akun dashboard yang sudah ada sebelum trigger ini dibuat.
insert into public.profiles (id, name, email, login_identifier, role, phone, is_active, must_change_password)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(coalesce(u.email, u.phone, 'Super Admin'), '@', 1)),
  u.email,
  lower(coalesce(u.email, public.normalize_phone(nullif(u.phone, '')), u.id::text)),
  'super_admin',
  public.normalize_phone(nullif(u.phone, '')),
  true,
  false
from auth.users u
where not (coalesce(u.raw_user_meta_data, '{}'::jsonb) ? 'role')
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
