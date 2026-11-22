-- ==============================================================================
-- MIGRATION 21 - RATE LIMIT UMUM (Fase 8, 22 Nov 2026)
-- Pembatas frekuensi untuk aksi publik/unggahan (formulir PPDB, cek status PPDB,
-- unggah bukti transfer, pengumpulan tugas). Login tetap memakai login_attempts.
-- hit_rate_limit() mencatat satu hit lalu menghitung hit di jendela waktu secara
-- atomik (advisory lock per kunci), sehingga permintaan bersamaan tidak lolos bersama.
-- Hanya service role (Server Action) yang dapat memanggil. Idempotent.
-- ==============================================================================

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  hit_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_hits_key_time
  on public.rate_limit_hits(bucket_key, hit_at desc);

-- RLS aktif tanpa policy: tidak dapat diakses anon/authenticated sama sekali.
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

/**
 * Mengembalikan true bila aksi DIIZINKAN (hit ke-n <= p_max dalam p_window_seconds).
 * Hit yang ditolak tidak dicatat, agar penyerang tidak memperpanjang blokirnya sendiri tanpa batas.
 */
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'Kunci rate limit tidak valid';
  end if;
  if p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Parameter rate limit tidak valid';
  end if;

  perform pg_advisory_xact_lock(hashtext('rate_limit:' || p_key));

  select count(*) into v_count
  from public.rate_limit_hits
  where bucket_key = p_key
    and hit_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket_key) values (p_key);

  -- Bersihkan catatan lama secara oportunistik (~1% panggilan).
  if random() < 0.01 then
    delete from public.rate_limit_hits where hit_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;
