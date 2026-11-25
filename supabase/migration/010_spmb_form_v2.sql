-- ==============================================================================
-- 010 - Formulir SPMB v2 (idempotent: aman dijalankan ulang)
-- Kolom baru formulir pendaftaran (3 langkah) + rekening biaya formulir SPMB
-- yang dapat diubah super admin di Dashboard -> Pengaturan Pembayaran.
-- NIK tidak lagi diisi dari formulir publik (kolom tetap ada, nullable).
-- ==============================================================================

alter table public.student_registration_applications
  add column if not exists nickname text,
  add column if not exists hobby text,
  add column if not exists achievements text,
  add column if not exists medical_history text,
  add column if not exists father_education text,
  add column if not exists mother_education text,
  add column if not exists parent_address text;

alter table public.payment_settings
  add column if not exists spmb_bank_account jsonb,
  add column if not exists spmb_transfer_instructions text;
