import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anon, createTempUser, qaFixtures, removeTempUsers, service, signIn, type TempUser } from './setup';

/**
 * Uji isolasi data (RLS) dan IDOR. Sasaran: data milik QA Murid Satu / QA Wali Satu.
 * Penyerang: murid lain, wali lain, guru tanpa penugasan, admin (untuk pelunasan), tamu.
 * Setiap uji "ditolak" dipasangkan dengan kontrol positif bahwa pemilik memang bisa membaca.
 */

let fx: Awaited<ReturnType<typeof qaFixtures>>;
let muridQa: SupabaseClient;
let waliQa: SupabaseClient;
let muridSeed: SupabaseClient;
let waliSeed: SupabaseClient;
let guruSiti: SupabaseClient;
let admin: SupabaseClient;

const temps: TempUser[] = [];

beforeAll(async () => {
  fx = await qaFixtures();
  [muridQa, waliQa, guruSiti, admin] = await Promise.all([
    signIn('muridQa'),
    signIn('waliQa'),
    signIn('guruSiti'),
    signIn('admin'),
  ]);
  const muridAttacker = await createTempUser('murid');
  const waliAttacker = await createTempUser('wali_murid');
  temps.push(muridAttacker, waliAttacker);
  muridSeed = muridAttacker.client;
  waliSeed = waliAttacker.client;
});

afterAll(async () => {
  await removeTempUsers(temps);
});

const countRows = async (client: SupabaseClient, table: string, column: string, value: string) => {
  const { data, error } = await client.from(table).select('id').eq(column, value);
  return { n: data?.length ?? 0, error };
};

describe('Tamu (anon)', () => {
  it.each(['student_registration_applications', 'profiles', 'students', 'payment_invoices', 'grades', 'payment_proofs', 'payment_settings'])(
    'tidak dapat membaca %s',
    async (table) => {
      const { data } = await anon.from(table).select('*').limit(5);
      expect(data ?? []).toHaveLength(0);
    }
  );

  it('tidak dapat mengunduh dokumen PPDB, materi, atau bukti transfer', async () => {
    if (fx.regDocPath) expect((await anon.storage.from('registration-files').download(fx.regDocPath)).error).not.toBeNull();
    if (fx.material) expect((await anon.storage.from('lms-files').download(fx.material.file_path)).error).not.toBeNull();
    if (fx.proof) expect((await anon.storage.from('payment-files').download(fx.proof.file_path)).error).not.toBeNull();
  });
});

describe('Murid lain (IDOR nilai, tugas, hafalan)', () => {
  it.each([
    ['grades', 'student_id'],
    ['assignment_submissions', 'student_id'],
    ['tahfidz_records', 'student_id'],
    ['student_attendances', 'student_id'],
  ])('murid lain tidak dapat membaca %s milik murid QA; murid QA dapat', async (table, column) => {
    const own = await countRows(muridQa, table, column, fx.studentId);
    const other = await countRows(muridSeed, table, column, fx.studentId);
    expect(other.n).toBe(0);
    if (table !== 'student_attendances') expect(own.n).toBeGreaterThan(0);
  });

  it('murid lain tidak dapat mengunduh berkas tugas murid QA', async () => {
    expect(fx.submission).not.toBeNull();
    const { error } = await muridSeed.storage.from('lms-files').download(fx.submission!.file_path);
    expect(error).not.toBeNull();
  });

  it('murid tidak dapat menaikkan role-nya sendiri', async () => {
    const { data: me } = await muridQa.auth.getUser();
    await muridQa.from('profiles').update({ role: 'super_admin' }).eq('id', me.user!.id);
    const { data } = await service.from('profiles').select('role').eq('id', me.user!.id).single();
    expect(data?.role).toBe('murid');
  });
});

describe('Wali lain (IDOR tagihan, bukti, kuitansi)', () => {
  it('wali lain tidak dapat membaca tagihan & kuitansi milik anak wali QA; wali QA dapat', async () => {
    expect(fx.paidInvoiceId).toBeDefined();
    const id = fx.paidInvoiceId!;
    expect((await countRows(waliQa, 'payment_invoices', 'id', id)).n).toBe(1);
    expect((await countRows(waliSeed, 'payment_invoices', 'id', id)).n).toBe(0);
    const { data: ownReceipt } = await waliQa.from('payment_receipts').select('id').eq('invoice_id', id);
    const { data: otherReceipt } = await waliSeed.from('payment_receipts').select('id').eq('invoice_id', id);
    expect(ownReceipt?.length ?? 0).toBeGreaterThan(0);
    expect(otherReceipt ?? []).toHaveLength(0);
  });

  it('wali lain tidak dapat membaca/mengunduh bukti transfer wali QA', async () => {
    expect(fx.proof).not.toBeNull();
    expect((await countRows(waliSeed, 'payment_proofs', 'id', fx.proof!.id)).n).toBe(0);
    expect((await waliSeed.storage.from('payment-files').download(fx.proof!.file_path)).error).not.toBeNull();
  });

  it('wali lain tidak dapat membaca data pokok & hafalan anak wali QA', async () => {
    expect((await countRows(waliSeed, 'students', 'id', fx.studentId)).n).toBe(0);
    expect((await countRows(waliSeed, 'tahfidz_records', 'student_id', fx.studentId)).n).toBe(0);
    expect((await countRows(waliQa, 'tahfidz_records', 'student_id', fx.studentId)).n).toBeGreaterThan(0);
  });
});

describe('Pelunasan hanya lewat verifikasi', () => {
  it('admin tidak dapat mengubah status tagihan menjadi paid lewat API', async () => {
    const { data: unpaid } = await service.from('payment_invoices').select('id').eq('status', 'unpaid').limit(1).single();
    const { error } = await admin.from('payment_invoices').update({ status: 'paid' }).eq('id', unpaid!.id);
    expect(error?.message).toMatch(/verifikasi pembayaran/i);
  });

  it('admin tidak dapat membatalkan status paid lewat API', async () => {
    const { error } = await admin.from('payment_invoices').update({ status: 'unpaid' }).eq('id', fx.paidInvoiceId!);
    expect(error).not.toBeNull();
  });

  it('fungsi internal _settle_invoice tidak dapat dipanggil klien', async () => {
    const { error } = await admin.rpc('_settle_invoice', {
      p_invoice_id: fx.paidInvoiceId, p_provider: 'cash', p_payer_bank: null, p_payer_name: null, p_payload: {},
    });
    expect(error?.message).toMatch(/permission denied/i);
  });

  it('wali tidak dapat menulis transaksi atau mencatat tunai', async () => {
    const tx = await waliQa.from('payment_transactions').insert({
      invoice_id: fx.paidInvoiceId, order_id: `QA-HACK-${Date.now()}`, gross_amount: 1000, status: 'paid', provider: 'manual_transfer',
    });
    expect(tx.error).not.toBeNull();
    const cash = await waliQa.rpc('record_cash_payment', { p_invoice_id: fx.paidInvoiceId, p_notes: 'hack' });
    expect(cash.error).not.toBeNull();
  });
});

describe('Guru tanpa penugasan', () => {
  it('guru Siti tidak dapat menambah materi di penugasan guru lain', async () => {
    expect(fx.material).not.toBeNull();
    const m = fx.material!;
    const { data: siti } = await guruSiti.auth.getUser();
    const { data: sitiTeacher } = await service.from('teachers').select('id').eq('profile_id', siti.user!.id).single();
    const { error } = await guruSiti.from('materials').insert({
      title: 'QA-XT hack', subject_id: m.subject_id, classroom_id: m.classroom_id, semester_id: m.semester_id, teacher_id: sitiTeacher!.id,
    });
    expect(error?.message).toMatch(/row-level security/i);
    await service.from('materials').delete().eq('title', 'QA-XT hack');
  });

  it('guru Siti tidak dapat mengubah atau menghapus materi guru lain', async () => {
    const m = fx.material!;
    const upd = await guruSiti.from('materials').update({ title: 'hacked' }).eq('id', m.id).select('id');
    const del = await guruSiti.from('materials').delete().eq('id', m.id).select('id');
    expect(upd.data ?? []).toHaveLength(0);
    expect(del.data ?? []).toHaveLength(0);
  });
});
