import { z } from 'zod';

const uuid = z.guid('Referensi data tidak valid.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

/** Jenis tagihan yang dibuat admin (marketplace dibuat otomatis oleh checkout). */
export const INVOICE_TYPES = [
  'spp',
  'iuran_ekstrakurikuler',
  'pendaftaran_semester_ganjil',
  'pendaftaran_semester_genap',
  'lainnya',
] as const;

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  spp: 'SPP',
  iuran_ekstrakurikuler: 'Iuran Kegiatan/Ekskul',
  pendaftaran_semester_ganjil: 'Daftar Ulang Ganjil',
  pendaftaran_semester_genap: 'Daftar Ulang Genap',
  marketplace: 'Marketplace',
  lainnya: 'Lainnya',
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.');

export const invoiceCreateSchema = z
  .object({
    target: z.enum(['student', 'classroom']),
    student_id: uuid.nullable().optional(),
    classroom_id: uuid.nullable().optional(),
    type: z.enum(INVOICE_TYPES),
    title: z.string().trim().min(3, 'Judul tagihan minimal 3 karakter.').max(160),
    amount: z.number().int('Nominal dalam rupiah bulat.').min(1000, 'Nominal minimal Rp1.000.').max(100_000_000),
    due_date: date,
    billing_month: z.number().int().min(1).max(12).nullable().optional(),
    billing_year: z.number().int().min(2020).max(2100).nullable().optional(),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.target === 'student' && !v.student_id) ctx.addIssue({ code: 'custom', path: ['student_id'], message: 'Pilih murid.' });
    if (v.target === 'classroom' && !v.classroom_id) ctx.addIssue({ code: 'custom', path: ['classroom_id'], message: 'Pilih kelas.' });
    if (v.type === 'spp' && (!v.billing_month || !v.billing_year)) {
      ctx.addIssue({ code: 'custom', path: ['billing_month'], message: 'Tagihan SPP wajib memiliki bulan dan tahun buku.' });
    }
  });

export const invoiceUpdateSchema = z.object({
  id: uuid,
  title: z.string().trim().min(3, 'Judul tagihan minimal 3 karakter.').max(160),
  amount: z.number().int().min(1000, 'Nominal minimal Rp1.000.').max(100_000_000),
  due_date: date,
  notes: optionalText(1000),
});

export const paymentProofSchema = z.object({
  invoice_id: uuid,
  amount: z.number().positive('Nominal tidak valid.'),
  transfer_date: date,
  sender_name: z.string().trim().min(3, 'Nama pengirim minimal 3 karakter.').max(120),
  sender_bank: z.string().trim().min(2, 'Bank pengirim wajib diisi.').max(80),
  notes: optionalText(500),
});

export const reviewProofSchema = z.object({
  proof_id: uuid,
  notes: optionalText(500),
});

export const rejectProofSchema = z.object({
  proof_id: uuid,
  reason: z.string().trim().min(5, 'Alasan penolakan minimal 5 karakter.').max(500),
});

export const cashPaymentSchema = z.object({
  invoice_id: uuid,
  notes: optionalText(500),
});

export const bankAccountSchema = z.object({
  bank: z.string().trim().min(2, 'Nama bank wajib diisi.').max(60),
  account_number: z.string().trim().regex(/^[0-9 -]{5,30}$/, 'Nomor rekening tidak valid.'),
  account_name: z.string().trim().min(3, 'Atas nama wajib diisi.').max(120),
});

export const paymentSettingsSchema = z.object({
  is_enabled: z.boolean(),
  manual_transfer_enabled: z.boolean(),
  is_spp_enabled: z.boolean(),
  is_iuran_enabled: z.boolean(),
  is_pendaftaran_semester_enabled: z.boolean(),
  is_marketplace_enabled: z.boolean(),
  bank_accounts: z.array(bankAccountSchema).max(5, 'Maksimal 5 rekening.'),
  manual_instructions: optionalText(2000),
  /** Rekening biaya formulir SPMB (ditampilkan di /spmb). Nominal mengikuti gelombang aktif. */
  spmb_bank_account: bankAccountSchema.nullable(),
  spmb_transfer_instructions: optionalText(2000),
});

export type InvoiceCreateInput = z.input<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.input<typeof invoiceUpdateSchema>;
export type PaymentProofInput = z.input<typeof paymentProofSchema>;
export type ReviewProofInput = z.input<typeof reviewProofSchema>;
export type RejectProofInput = z.input<typeof rejectProofSchema>;
export type CashPaymentInput = z.input<typeof cashPaymentSchema>;
export type PaymentSettingsInput = z.input<typeof paymentSettingsSchema>;
export type BankAccount = z.output<typeof bankAccountSchema>;
