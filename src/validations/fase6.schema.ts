import { z } from 'zod';
import { TAHFIDZ_PREDICATES } from '@/constants/quran';
import { USER_ROLES } from '@/constants/auth';

const uuid = z.guid('Referensi data tidak valid.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

// ============================================================================
// PENGUMUMAN
// ============================================================================

export const announcementSchema = z
  .object({
    title: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(160),
    content: z.string().trim().min(3, 'Isi pengumuman wajib diisi.').max(10000),
    target_type: z.enum(['all', 'role', 'class', 'student']),
    target_role: z.enum(USER_ROLES).nullable().optional(),
    classroom_id: uuid.nullable().optional(),
    student_id: uuid.nullable().optional(),
    status: z.enum(['draft', 'published', 'archived']),
  })
  .superRefine((value, ctx) => {
    if (value.target_type === 'role' && !value.target_role) {
      ctx.addIssue({ code: 'custom', path: ['target_role'], message: 'Pilih peran tujuan.' });
    }
    if (value.target_type === 'class' && !value.classroom_id) {
      ctx.addIssue({ code: 'custom', path: ['classroom_id'], message: 'Pilih kelas tujuan.' });
    }
    if (value.target_type === 'student' && !value.student_id) {
      ctx.addIssue({ code: 'custom', path: ['student_id'], message: 'Pilih murid tujuan.' });
    }
  });

export const announcementUpdateSchema = z.object({ id: uuid }).and(announcementSchema);

// ============================================================================
// TAHFIDZ
// ============================================================================

export const tahfidzRecordSchema = z
  .object({
    student_id: uuid,
    surah_number: z.number().int().min(1, 'Surah tidak valid.').max(114, 'Surah tidak valid.'),
    ayat_start: z.number().int().min(1, 'Ayat mulai minimal 1.'),
    ayat_end: z.number().int().min(1, 'Ayat selesai minimal 1.'),
    pages: z
      .number()
      .min(0, 'Jumlah halaman tidak boleh negatif.')
      .max(604, 'Jumlah halaman tidak valid.')
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    predicate: z.enum(TAHFIDZ_PREDICATES),
    record_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.'),
    notes: optionalText(1000),
  })
  .refine((v) => v.ayat_end >= v.ayat_start, { message: 'Ayat selesai harus ≥ ayat mulai.', path: ['ayat_end'] });

export const tahfidzUpdateSchema = z.object({ id: uuid }).and(tahfidzRecordSchema);

// ============================================================================
// MARKETPLACE
// ============================================================================

export const productSchema = z
  .object({
    title: z.string().trim().min(3, 'Nama produk minimal 3 karakter.').max(160),
    description: optionalText(5000),
    price: z.number().int('Harga dalam rupiah bulat.').min(1000, 'Harga minimal Rp1.000.').max(100_000_000),
    product_type: z.enum(['physical', 'digital']),
    stock: z
      .number()
      .int()
      .min(0, 'Stok tidak boleh negatif.')
      .max(100000)
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    is_published: z.boolean(),
  });

export const productUpdateSchema = z.object({ id: uuid, remove_file: z.boolean().default(false) }).and(productSchema);

export const checkoutSchema = z.object({
  student_id: uuid,
  items: z
    .array(z.object({ product_id: uuid, quantity: z.number().int().min(1).max(100) }))
    .min(1, 'Keranjang masih kosong.')
    .max(50),
});

export type AnnouncementInput = z.input<typeof announcementSchema>;
export type AnnouncementUpdateInput = z.input<typeof announcementUpdateSchema>;
export type TahfidzRecordInput = z.input<typeof tahfidzRecordSchema>;
export type TahfidzUpdateInput = z.input<typeof tahfidzUpdateSchema>;
export type ProductInput = z.input<typeof productSchema>;
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;
export type CheckoutInput = z.input<typeof checkoutSchema>;
