# Migration Final — SDIT Fajar (project Supabase baru)

Folder ini berisi skema database dalam **bentuk akhir**, hasil perapian dari `supabase/migrations/` (000000–000021).
Dipakai untuk membangun project Supabase **baru yang masih kosong**. Folder `migrations/` lama tetap disimpan sebagai riwayat.

Yang dirapikan:
- Tidak ada lagi pola "buat lalu hapus": kolom `teachers.nip` tidak pernah dibuat; `teachers.nuptk` langsung `NOT NULL UNIQUE`.
  `students.nisn` tetap ada karena masih dipakai aplikasi.
- Kolom/constraint tambahan (fase 5–8) langsung masuk ke `CREATE TABLE`.
- Fungsi, trigger, dan policy hanya versi terakhir (policy lama yang sudah diganti tidak ikut).
- Perbaikan data lama (repair auth 009, normalisasi nomor HP 013, backfill `invoice_number`) dihapus karena database baru kosong.
- Nomor registrasi langsung format `SPMB-YYYY-XXXX`.

## Urutan menjalankan (wajib berurutan)

Jalankan di **Supabase Dashboard → SQL Editor** (satu file per query, klik Run), atau dengan `psql -f`.

| No | File | Isi |
|:-:|---|---|
| 1 | `001_extensions_enums_helpers.sql` | `pgcrypto`, 12 enum, `handle_updated_at()`, `current_profile_id()` |
| 2 | `002_core_tables.sql` | Profil, pengaturan sekolah, audit log, tahun ajaran, semester, kelas, jabatan, guru, murid, wali, rombel, mapel, jadwal, `login_attempts`, `rate_limit_hits` |
| 3 | `003_academic_lms_tables.sql` | Gelombang & pendaftaran SPMB, presensi, materi, tugas, pengumpulan, nilai, pengumuman, berita, tahfidz, riwayat import |
| 4 | `004_payment_marketplace_tables.sql` | Pengaturan pembayaran (transfer manual), produk, pesanan, tagihan, transaksi, kuitansi, `payment_proofs` |
| 5 | `005_functions_triggers.sql` | Helper role, trigger `updated_at` & integritas, RPC (import CSV, marketplace, pembayaran, rate limit) + grant |
| 6 | `006_rls_policies.sql` | RLS aktif di 41 tabel + seluruh policy |
| 7 | `007_storage.sql` | 5 bucket storage + policy bucket `images` |
| 8 | `008_function_privileges.sql` | Tutup akses RPC yang tidak perlu (fungsi trigger, helper RLS untuk anon, `log_audit_event`), `search_path` tetap |
| 9 | `009_sync_auth_users_to_profiles.sql` | Akun dari Dashboard → Authentication → Add user otomatis masuk `profiles` sebagai `super_admin` (akun buatan aplikasi dilewati) |
| 10 | `010_spmb_form_v2.sql` | Kolom formulir SPMB v2 (nama panggilan, hobi, prestasi, riwayat penyakit, pendidikan ortu, alamat ortu) + rekening biaya formulir SPMB di `payment_settings`. Sudah termasuk di 003/004 untuk database baru; wajib dijalankan pada database yang dibuat sebelum perubahan ini |

### Seed demo (opsional — jangan di produksi)

| No | File | Isi |
|:-:|---|---|
| 8 | `seed/001_demo_auth_users.sql` | 7 akun demo di `auth.users`/`auth.identities` + profil |
| 9 | `seed/002_demo_data.sql` | Jabatan, guru (NUPTK), murid, wali, rombel 3-A, jadwal, tagihan demo, gelombang SPMB |
| — | `seed/seed.sql` | **Seed lengkap mandiri** (cukup ini saja, tanpa 001–003): 8 akun demo + data contoh untuk semua tabel kecuali `audit_logs`, `login_attempts`, `rate_limit_hits`. Akun & login tertulis di kepala file |
| — | `seed/003_akun_login_awal.sql` | **Jalankan manual.** 4 akun login per role (murid NIS `123456789`, wali HP `089517795206`, guru `azzam@sditfajar.sch.id`/`ustahmad`, admin `admin@sditfajar.sch.id`/`admin`), password `sditfajar.sch.id`. Berdiri sendiri, tidak butuh seed 001/002 |

Password semua akun demo: `sditfajar.sch.id`. Hapus/ganti akun ini sebelum go-live (lihat `supabase/scripts/pre-golive-cleanup.sql`).

## Setelah migrasi

1. Perbarui `.env` aplikasi dengan URL, anon key, dan service role key project baru.
2. Atur Auth (Site URL, redirect URL) di Dashboard → Authentication → URL Configuration.
3. Buat akun super admin sungguhan bila tidak memakai seed.

## Checklist verifikasi

- [ ] Table Editor: 41 tabel di skema `public`, semua berlabel RLS enabled.
- [ ] `select column_name from information_schema.columns where table_name = 'teachers';` tidak berisi `nip`.
- [ ] Storage: 5 bucket — `images` (publik), `lms-files`, `registration-files`, `marketplace-files`, `payment-files` (privat).
- [ ] `select public.generate_registration_number();` menghasilkan `SPMB-<tahun>-1001`.
- [ ] (Bila seed dijalankan) Authentication → Users berisi 7 akun terkonfirmasi dan login demo berhasil.
