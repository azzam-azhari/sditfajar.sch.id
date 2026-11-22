-- Istilah PPDB diganti SPMB (Sistem Penerimaan Murid Baru).
-- Nomor registrasi baru berformat SPMB-YYYY-XXXX. Nomor lama (PPDB-...) tidak diubah
-- dan tetap valid untuk cek status. Sequence yang sama dipakai, jadi tidak ada bentrok.
-- Rollback: jalankan ulang definisi fungsi dari migration 000012 (prefix 'PPDB-').

create or replace function public.generate_registration_number()
returns text
language plpgsql
security definer
as $$
declare
  v_year text;
  v_seq bigint;
begin
  v_year := to_char(now(), 'YYYY');
  v_seq := nextval('public.seq_registration_number');
  return 'SPMB-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

grant execute on function public.generate_registration_number() to public, authenticated, service_role;
