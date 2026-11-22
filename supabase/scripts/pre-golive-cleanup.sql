-- ==============================================================================
-- PEMBERSIHAN DATA UJI SEBELUM GO-LIVE (Fase 8) — BUKAN MIGRATION
-- Database staging = database produksi. Jalankan SEKALI tepat sebelum go-live,
-- setelah UAT sekolah selesai, di Supabase SQL Editor.
--
-- AMAN SECARA BAWAAN: seluruh skrip berada dalam satu transaksi yang diakhiri
-- ROLLBACK. Jalankan apa adanya untuk melihat jumlah baris yang AKAN dihapus.
-- Setelah angka diperiksa, ganti `rollback;` di baris terakhir menjadi `commit;`.
--
-- Yang dihapus: akun & data berawalan QA (dibuat saat QA/UAT oleh tim pengembang).
-- Yang TIDAK dihapus otomatis (periksa manual, lihat checklist di bawah):
--   akun demo seed, data murid/wali yang diinput manual saat uji, logo, jabatan guru.
-- Berkas di Storage tidak ikut terhapus oleh SQL; bersihkan folder terkait di dashboard.
-- ==============================================================================

begin;

-- 1. Akun uji QA (cascade: profiles -> students/parents -> nilai, tugas, presensi,
--    hafalan, tagihan, bukti, kuitansi, pesanan marketplace milik akun tersebut).
create temporary table qa_users on commit drop as
select id, email
from auth.users
where email in (
  '990001@siswa.sdit-fajar.sch.id',          -- QA Murid Satu
  '089900000001@wali.sdit-fajar.sch.id'      -- QA Wali Satu
)
or email like 'qa.%@sditfajar.sch.id'
or email like 'qa-attacker-%';

select 'akun QA' as data, count(*) as jumlah from qa_users;

-- 2. Konten uji berawalan QA
select 'materi QA' as data, count(*) from public.materials where title like 'QA-%'
union all select 'tugas QA', count(*) from public.assignments where title like 'QA-%'
union all select 'pengumuman QA', count(*) from public.announcements where title like 'QA-%'
union all select 'berita QA', count(*) from public.news_posts where title like 'QA %' or title like 'QA-%'
union all select 'tagihan QA', count(*) from public.payment_invoices where title like 'QA %' or title like 'QA-%'
union all select 'produk QA', count(*) from public.marketplace_products where title like 'QA-%';

delete from auth.users where id in (select id from qa_users);

delete from public.materials where title like 'QA-%';
delete from public.assignments where title like 'QA-%';
delete from public.announcements where title like 'QA-%';
delete from public.news_posts where title like 'QA %' or title like 'QA-%';
delete from public.payment_invoices where title like 'QA %' or title like 'QA-%';
-- Produk hanya bisa dihapus bila tidak ada lagi item pesanan yang merujuknya (on delete restrict).
delete from public.marketplace_products p
where p.title like 'QA-%'
  and not exists (select 1 from public.marketplace_order_items i where i.product_id = p.id);

-- 3. Rekening uji di pengaturan pembayaran
update public.payment_settings
set bank_accounts = coalesce(
  (select jsonb_agg(b) from jsonb_array_elements(bank_accounts) b where b->>'bank' not ilike '%QA%'),
  '[]'::jsonb
)
where bank_accounts::text ilike '%QA%';

-- 4. Sisa data berawalan QA yang perlu diperiksa manual (seharusnya 0)
select 'sisa produk QA (masih dipesan)' as data, count(*) from public.marketplace_products where title like 'QA-%'
union all select 'sisa profil QA', count(*) from public.profiles where name like 'QA %';

-- Ganti menjadi `commit;` setelah angka di atas diperiksa.
rollback;

-- ==============================================================================
-- CHECKLIST MANUAL SEBELUM GO-LIVE (tidak dilakukan skrip ini)
-- [ ] Ganti kata sandi / nonaktifkan 7 akun demo seed (superadmin, admin, kepsek,
--     ustahmad, ustsiti, ahmad.fajar, wali) atau ganti dengan akun staf asli.
-- [ ] Hapus murid/wali uji yang diinput manual (mis. "Wawa", "Fulan", "Azzam") bila bukan data asli.
-- [ ] Cabut jabatan `bendahara` uji dari Ustadz Ahmad bila bukan jabatan aslinya.
-- [ ] Ganti logo uji di Pengaturan Sekolah dengan logo resmi; isi alamat resmi sekolah.
-- [ ] Storage: hapus berkas uji di bucket payment-files, lms-files, marketplace-files, images/news.
-- [ ] Ganti rekening tujuan transfer dengan rekening resmi sekolah.
-- ==============================================================================
