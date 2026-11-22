# Panduan Eksekusi SQL Migrasi Database — SDIT Fajar

Panduan ini mengatur tata cara menempelkan dan menjalankan berkas migrasi SQL ke project Supabase Anda melalui **Supabase Web Dashboard (SQL Editor)** dengan **Opsi B (Eksekusi Bertahap / Modular)**.

---

## 1. Urutan Running Berkas SQL (Wajib Berurutan)

Jalankan berkas berikut **satu per satu secara berurutan** dari nomor `01` sampai `21`. Jangan melompati urutan karena setiap berkas memiliki ketergantungan relasional (*Foreign Key* & *Dependencies*) ke berkas sebelumnya:

| Urutan | Nama Berkas | Komponen / Fungsi Utama |
|:---:|---|---|
| **1** | `20261026_000001_create_enums_and_helpers.sql` | Ekstensi `pgcrypto`, 12 tipe Enum resmi, dan fungsi `handle_updated_at()`. |
| **2** | `20261026_000002_create_core_tables.sql` | Tabel `profiles`, setting sekolah, tahun akademik, semester, kelas, mapel, guru, murid, dan wali murid. |
| **3** | `20261026_000003_create_academic_lms_tables.sql` | Tabel PPDB (`registrations`), LMS (materi, tugas, submission), absensi, target & mutabaah tahfidz, pengumuman, dan artikel. |
| **4** | `20261026_000004_create_payment_marketplace_tables.sql` | Tabel konfigurasi Midtrans, invoice SPP/iuran, log transaksi pembayaran, produk, dan pesanan marketplace seragam/buku. |
| **5** | `20261026_000005_create_storage_buckets.sql` | Inisialisasi 4 Supabase Storage Bucket (`images`, `lms-files`, `registration-files`, `marketplace-files`) dan storage policies. |
| **6** | `20261026_000006_enable_rls_and_policies.sql` | Fungsi helper otorisasi role, aktivasi Row Level Security (RLS) pada seluruh tabel (38 tabel), dan seluruh security policies. |
| **7** | `20261026_000007_seed_auth_users.sql` | Inisialisasi 7 akun demo di sistem otentikasi Supabase GoTrue (`auth.users` & `auth.identities`) dengan password bcrypt. |
| **8** | `20261026_000008_seed_development_data.sql` | Inisialisasi data awal pengembangan (jabatan guru, rombel kelas 3-A, jadwal pelajaran, tagihan invoice demo, dan gelombang PPDB). |
| **9** | `20261026_000009_repair_auth_users.sql` | Sinkronisasi field boolean `is_sso_user` & `is_anonymous` Supabase GoTrue agar login tidak menghasilkan error schema 500. |
| **10** | `20261026_000010_fix_rls_infinite_recursion.sql` | Perbaikan error PostgreSQL 42P17 (infinite recursion RLS) pada tabel `parent_students` & `profiles` agar login langsung mengarah ke dashboard role. |
| **11** | `20261026_000011_harden_lms_attendance.sql` | Status presensi `sick`, trigger integritas submission/presensi, policy LMS berbasis penugasan guru, dan menutup akses langsung bucket `lms-files`. |
| **12** | `20261026_000012_harden_ppdb_registration.sql` | Kolom `mother_phone`, unique (NIK, gelombang), nomor registrasi berbasis sequence, dan policy DELETE pendaftaran untuk admin. |
| **13** | `20261121_000013_harden_auth_profiles_storage.sql` | Hasil QA: policy UPDATE `profiles` khusus admin (memperbaiki rekursi 42P17), upload bucket `images` khusus admin, tabel `login_attempts` untuk rate limit login, dan normalisasi nomor HP lama. |
| **14** | `20261121_000014_atomic_csv_import.sql` | Hasil QA: RPC `import_csv_batch` agar import CSV tersimpan dalam satu transaksi (wajib untuk fitur Import CSV). |
| **15** | `20261121_000015_fase5_lms_completion.sql` | Fase 5: `assignments.late_tolerance_minutes`, integritas pengumpulan ulang, presensi guru (tepat waktu ≤07.00, terlambat s.d. 23.59, check-out ≥14.30), koreksi presensi murid hari yang sama, nilai akhir unik, tolak jadwal bentrok, RLS baca LMS/pengumuman. |
| **16** | `20261122_000016_fase6_announcement_tahfidz_marketplace.sql` | Fase 6: pengumuman (dibuat super admin/admin/kepala sekolah, target konsisten), tahfidz (kolom `pages`, pencatat dibatasi `can_record_tahfidz`), marketplace (`product_type`, `stock`, `cover_path`, `order_number`, fungsi `create_marketplace_order` & `cancel_marketplace_order`; wali tidak lagi menulis pesanan langsung). |
| **17** | `20261122_000017_coordinator_student_read.sql` | Koordinator tahfidz dapat membaca data pokok murid (NIS/nama) untuk rekap tahfidz. |
| **18** | `20261122_000018_fase7_manual_payment.sql` | Fase 7: pembayaran manual tanpa gateway. `is_finance_staff()` (admin/super admin/bendahara), `invoice_number` otomatis, trigger `guard_invoice_paid`, kolom rekening/instruksi di `payment_settings`, tabel `payment_proofs` + bucket privat `payment-files`, fungsi `submit_payment_proof`, `approve_payment_proof`, `reject_payment_proof`, `record_cash_payment`; wali tidak lagi menulis transaksi langsung. |
| **19** | `20261122_000019_teacher_nuptk.sql` | NUPTK menjadi nomor induk guru: `teachers.nuptk` NOT NULL, fungsi `import_csv_batch` tanpa NIP, dan kolom `teachers.nip` dihapus. Gagal dengan pesan jelas bila masih ada guru tanpa NUPTK. |
| **20** | `20261122_000020_spmb_registration_number.sql` | Istilah PPDB menjadi SPMB: nomor registrasi baru berformat `SPMB-YYYY-XXXX` (nomor lama `PPDB-...` tetap valid). |
| **21** | `20261122_000021_rate_limits.sql` | Fase 8: tabel `rate_limit_hits` + fungsi atomik `hit_rate_limit` (service role saja) untuk membatasi formulir SPMB, cek status SPMB, unggah bukti transfer, dan pengumpulan tugas. Aplikasi tetap berjalan (fail-open) bila belum dijalankan. |

---

## 2. Langkah-demi-Langkah di Supabase Web Dashboard

1. **Buka Supabase Dashboard**:
   - Masuk ke [https://supabase.com/dashboard](https://supabase.com/dashboard) dan pilih project SDIT Fajar Anda.
2. **Masuk ke SQL Editor**:
   - Di menu navigasi samping kiri, klik ikon **SQL Editor** (atau tekan shortcut keyboard).
   - Klik tombol **`+ New Query`** di pojok kanan atas.
3. **Tempelkan & Jalankan (Ulangi untuk Berkas 01 s/d 08)**:
   - Buka berkas `20261026_000001_create_enums_and_helpers.sql` di text editor lokal Anda (VS Code/Cursor).
   - Salin (*Copy*) seluruh isinya (`Ctrl + A` lalu `Ctrl + C`).
   - Tempel (*Paste*) ke dalam kolom query Supabase SQL Editor.
   - Klik tombol hijau **`Run`** (atau tekan `Ctrl + Enter`).
   - Pastikan muncul notifikasi **`Success. No rows returned`** (atau ringkasan status sukses).
4. **Lanjutkan ke Berkas Berikutnya**:
   - Buat tab baru (`+ New query`) atau bersihkan editor, lalu salin berkas `20261026_000002_create_core_tables.sql` dan klik **Run**.
   - Teruskan langkah ini secara disiplin sampai berkas `20261026_000008_seed_development_data.sql`.

---

## 3. Daftar Akun Demo Siap Pakai

Setelah berkas `07` dan `08` berhasil dijalankan, 7 akun pengguna demo berikut otomatis aktif dan dapat langsung digunakan untuk login di website:

> **Kata Sandi Resmi Seluruh Akun Demo**: `sditfajar.sch.id`

| Role Aplikasi | Nama Lengkap Akun | Email Login | Login Identifier (NIS / WA) | Keterangan Akses |
|---|---|---|---|---|
| `super_admin` | Super Admin SDIT Fajar | `superadmin@sditfajar.sch.id` | `superadmin` | Akses penuh seluruh sistem & konfigurasi Midtrans |
| `admin` | Admin Sekolah | `admin@sditfajar.sch.id` | `admin` | Manajemen master data, verifikasi PPDB, buat invoice |
| `guru` | Kepala Sekolah SDIT Fajar | `kepsek@sditfajar.sch.id` | `kepsek` | Dashboard Guru (Jabatan: Kepala Sekolah) |
| `guru` | Ustadz Ahmad Fauzi | `ustahmad@sditfajar.sch.id` | `ustahmad` | Dashboard Guru (Wali Kelas 3-A, Guru Matematika) |
| `guru` | Ustadzah Siti Aminah | `ustsiti@sditfajar.sch.id` | `ustsiti` | Dashboard Guru (Koordinator Tahfidz, Guru PAI) |
| `murid` | Ahmad Fajar | `ahmad.fajar@sditfajar.sch.id` | `202603001` (NIS) | Dashboard Murid (LMS, Jadwal, Nilai, Read-Only SPP) |
| `wali_murid` | Bapak Hendra Gunawan | `wali@sditfajar.sch.id` | `081234567890` (WA) | Dashboard Wali (Bayar SPP via Snap Midtrans, Raport) |

---

## 4. Checklist Verifikasi Pasca Eksekusi

Buka menu-menu berikut di Supabase Dashboard untuk memastikan migrasi 100% sempurna:

- [ ] **Table Editor**: Terdapat 24 tabel pada skema `public` (mulai dari `academic_years`, `classrooms`, `profiles`, `students`, hingga `registrations`).
- [ ] **Authentication > Users**: Terdaftar 7 pengguna dengan status email terkonfirmasi (*Confirmed*).
- [ ] **Authentication > Policies**: Status RLS berlabel hijau (*RLS Enabled*) pada seluruh 24 tabel publik.
- [ ] **Storage**: Terdapat 4 bucket:
  - `images` (Public)
  - `lms-files` (Private)
  - `registration-files` (Private)
  - `marketplace-files` (Private)
