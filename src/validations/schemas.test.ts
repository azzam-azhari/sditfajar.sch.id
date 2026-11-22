import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth.schema';
import { bankAccountSchema, invoiceCreateSchema, paymentProofSchema, rejectProofSchema } from './payment.schema';
import { teacherCsvRowSchema } from './import.schema';
import { createStaffUserSchema } from './super-admin.schema';
import { checkoutSchema, tahfidzRecordSchema } from './fase6.schema';
import { assignmentSchema } from './lms.schema';

const ID = '3f2b8c1e-5d4a-4c3b-9a2e-1f0d7c6b5a49';
const SEED_ID = '00000000-0000-0000-0000-000000000004'; // ID seed berpola tetap harus tetap diterima

describe('loginSchema', () => {
  it.each(['990001', '0812 3456 7890', '+62 (812) 3456-7890', 'admin@sditfajar.sch.id'])('menerima identitas %s', (identifier) => {
    expect(loginSchema.safeParse({ identifier, password: 'rahasia123' }).success).toBe(true);
  });

  it.each(["a,b.or(role.eq.admin)", "x'; drop", 'nama"kutip', '<script>'])('menolak karakter sintaks filter: %s', (identifier) => {
    expect(loginSchema.safeParse({ identifier, password: 'rahasia123' }).success).toBe(false);
  });
});

describe('pembayaran', () => {
  const proof = { invoice_id: ID, amount: 350000, transfer_date: '2026-11-22', sender_name: 'QA Wali', sender_bank: 'BCA' };

  it('bukti transfer valid; ID seed diterima', () => {
    expect(paymentProofSchema.safeParse(proof).success).toBe(true);
    expect(paymentProofSchema.safeParse({ ...proof, invoice_id: SEED_ID }).success).toBe(true);
  });

  it('menolak nominal nol dan nama pengirim terlalu pendek', () => {
    expect(paymentProofSchema.safeParse({ ...proof, amount: 0 }).success).toBe(false);
    expect(paymentProofSchema.safeParse({ ...proof, sender_name: 'AB' }).success).toBe(false);
  });

  it('tagihan SPP wajib bulan & tahun buku', () => {
    const base = { target: 'classroom', classroom_id: ID, type: 'spp', title: 'SPP Nov', amount: 350000, due_date: '2026-11-30' } as const;
    expect(invoiceCreateSchema.safeParse(base).success).toBe(false);
    expect(invoiceCreateSchema.safeParse({ ...base, billing_month: 11, billing_year: 2026 }).success).toBe(true);
  });

  it('tagihan untuk murid wajib memilih murid', () => {
    const r = invoiceCreateSchema.safeParse({ target: 'student', type: 'lainnya', title: 'Iuran', amount: 50000, due_date: '2026-11-30' });
    expect(r.success).toBe(false);
  });

  it('penolakan bukti wajib alasan ≥ 5 karakter', () => {
    expect(rejectProofSchema.safeParse({ proof_id: ID, reason: 'buram' }).success).toBe(true);
    expect(rejectProofSchema.safeParse({ proof_id: ID, reason: 'no' }).success).toBe(false);
  });

  it('nomor rekening hanya angka/spasi/strip', () => {
    expect(bankAccountSchema.safeParse({ bank: 'BSI', account_number: '7000 000 001', account_name: 'Yayasan' }).success).toBe(true);
    expect(bankAccountSchema.safeParse({ bank: 'BSI', account_number: '70abc', account_name: 'Yayasan' }).success).toBe(false);
  });
});

describe('NUPTK guru', () => {
  const row = { nuptk: '9900000000000001', name: 'Ustadz Uji', email: 'uji@sditfajar.sch.id', phone: '081299000001' };

  it.each([
    ['9900000000000001', true],
    ['990000000000001', false],
    ['99000000000000012', false],
    ['99000000000000AB', false],
    ['', false],
  ])('import CSV NUPTK "%s" -> %s', (nuptk, ok) => {
    expect(teacherCsvRowSchema.safeParse({ ...row, nuptk }).success).toBe(ok);
  });

  it('akun guru baru wajib NUPTK 16 digit; akun admin tidak', () => {
    const staff = { name: 'Ustadz Uji', email: 'uji@sditfajar.sch.id', role: 'guru' } as const;
    expect(createStaffUserSchema.safeParse(staff).success).toBe(false);
    expect(createStaffUserSchema.safeParse({ ...staff, nuptk: '9900000000000001' }).success).toBe(true);
    expect(createStaffUserSchema.safeParse({ ...staff, role: 'admin' }).success).toBe(true);
  });
});

describe('tahfidz & marketplace', () => {
  const rec = { student_id: ID, surah_number: 78, ayat_start: 1, ayat_end: 10, predicate: 'mumtaz', record_date: '2026-11-22' };

  it('ayat selesai tidak boleh lebih kecil dari ayat mulai', () => {
    expect(tahfidzRecordSchema.safeParse(rec).success).toBe(true);
    expect(tahfidzRecordSchema.safeParse({ ...rec, ayat_start: 11 }).success).toBe(false);
  });

  it('nomor surah 1–114', () => {
    expect(tahfidzRecordSchema.safeParse({ ...rec, surah_number: 115 }).success).toBe(false);
  });

  it('checkout menolak keranjang kosong dan kuantitas 0', () => {
    expect(checkoutSchema.safeParse({ student_id: ID, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ student_id: ID, items: [{ product_id: ID, quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ student_id: ID, items: [{ product_id: ID, quantity: 2 }] }).success).toBe(true);
  });
});

describe('LMS', () => {
  const asg = {
    title: 'Tugas Pecahan',
    description: 'Kerjakan soal 1-10',
    subject_id: ID,
    classroom_id: ID,
    semester_id: ID,
    due_at: '2026-11-30T23:59:00+07:00',
    status: 'published',
  } as const;

  it('tugas valid dengan zona waktu', () => {
    expect(assignmentSchema.safeParse(asg).success).toBe(true);
  });

  it('menolak toleransi terlambat negatif dan due_at tanpa zona waktu', () => {
    expect(assignmentSchema.safeParse({ ...asg, late_tolerance_minutes: -5 }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...asg, due_at: '2026-11-30 23:59' }).success).toBe(false);
  });
});
