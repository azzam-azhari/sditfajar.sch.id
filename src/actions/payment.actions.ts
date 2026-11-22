'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireRole, requireUser } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminSignedUrl, deleteStorageFile, uploadStorageFile } from '@/lib/supabase/storage';
import { dbError, revalidateDashboards, validationError, writeAudit } from '@/lib/actions/helpers';
import { getPaymentSettings, isPayable } from '@/lib/data/payment';
import { allowRequest, rateLimitedError } from '@/lib/rate-limit';
import type { ActionResult } from '@/types/action.types';
import {
  cashPaymentSchema, invoiceCreateSchema, invoiceUpdateSchema, paymentProofSchema, paymentSettingsSchema,
  rejectProofSchema, reviewProofSchema,
  type CashPaymentInput, type InvoiceCreateInput, type InvoiceUpdateInput, type PaymentProofInput,
  type PaymentSettingsInput, type RejectProofInput, type ReviewProofInput,
} from '@/validations/payment.schema';

const uuid = z.guid();

// ============================================================================
// ADMIN: TAGIHAN
// ============================================================================

export async function createInvoicesAction(
  input: InvoiceCreateInput
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const { user } = await requireRole(['admin', 'super_admin']);
  const parsed = invoiceCreateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const supabase = await createClient();

  const { data: year } = await supabase.from('academic_years').select('id').eq('is_active', true).maybeSingle();
  if (!year) return { success: false, error: 'Belum ada tahun ajaran aktif.', code: 'NOT_FOUND' };

  let studentIds: string[] = [];
  if (data.target === 'student') {
    studentIds = [data.student_id!];
  } else {
    const { data: members } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('classroom_id', data.classroom_id!)
      .eq('status', 'active')
      .is('left_at', null);
    studentIds = (members ?? []).map((m) => m.student_id);
  }
  if (studentIds.length === 0) return { success: false, error: 'Tidak ada murid aktif pada target tersebut.', code: 'NOT_FOUND' };

  // Lewati murid yang sudah punya tagihan aktif sejenis pada periode yang sama.
  let dupQuery = supabase
    .from('payment_invoices')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('type', data.type)
    .neq('status', 'cancelled');
  dupQuery = data.billing_month ? dupQuery.eq('billing_month', data.billing_month) : dupQuery.is('billing_month', null);
  dupQuery = data.billing_year ? dupQuery.eq('billing_year', data.billing_year) : dupQuery.is('billing_year', null);
  if (data.type !== 'spp') dupQuery = dupQuery.eq('title', data.title);
  const { data: dups } = await dupQuery;
  const already = new Set((dups ?? []).map((d) => d.student_id));
  const targets = studentIds.filter((id) => !already.has(id));

  if (targets.length > 0) {
    const { error } = await supabase.from('payment_invoices').insert(
      targets.map((studentId) => ({
        student_id: studentId,
        academic_year_id: year.id,
        type: data.type,
        title: data.title,
        amount: data.amount,
        due_date: data.due_date,
        billing_month: data.billing_month ?? null,
        billing_year: data.billing_year ?? null,
        notes: data.notes,
        status: 'unpaid',
        created_by: user.id,
      }))
    );
    if (error) return dbError(error, 'Gagal membuat tagihan.');
  }
  await writeAudit('create_invoices', 'payment_invoices', null, { type: data.type, created: targets.length, skipped: already.size });
  revalidateDashboards();
  return {
    success: true,
    data: { created: targets.length, skipped: already.size },
    message: `${targets.length} tagihan dibuat${already.size ? `, ${already.size} dilewati karena sudah ada` : ''}.`,
  };
}

export async function updateInvoiceAction(input: InvoiceUpdateInput): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin']);
  const parsed = invoiceUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_invoices')
    .update(fields)
    .eq('id', id)
    .eq('status', 'unpaid')
    .is('marketplace_order_id', null)
    .select('id');
  if (error) return dbError(error, 'Gagal memperbarui tagihan.');
  if (!data?.length) return { success: false, error: 'Hanya tagihan berstatus belum dibayar (non-marketplace) yang dapat diubah.', code: 'FORBIDDEN' };
  await writeAudit('update_invoice', 'payment_invoices', id, { amount: fields.amount });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Tagihan diperbarui.' };
}

export async function cancelInvoiceAction(id: string): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin']);
  if (!uuid.safeParse(id).success) return { success: false, error: 'Tagihan tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_invoices')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'unpaid')
    .is('marketplace_order_id', null)
    .select('id');
  if (error) return dbError(error, 'Gagal membatalkan tagihan.');
  if (!data?.length) {
    return { success: false, error: 'Hanya tagihan belum dibayar yang dapat dibatalkan (tolak dulu bukti yang menunggu verifikasi).', code: 'FORBIDDEN' };
  }
  await writeAudit('cancel_invoice', 'payment_invoices', id, {});
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Tagihan dibatalkan.' };
}

// ============================================================================
// WALI MURID: BUKTI TRANSFER
// ============================================================================

export async function submitPaymentProofAction(input: PaymentProofInput, file: File | null): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireRole(['wali_murid']);
  if (!(await allowRequest('paymentProof', user.id))) {
    return rateLimitedError('Terlalu banyak unggahan bukti. Silakan coba lagi dalam 1 jam.');
  }
  const parsed = paymentProofSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  if (!file || file.size === 0) return { success: false, error: 'Unggah foto atau PDF bukti transfer.', code: 'VALIDATION_ERROR' };

  const supabase = await createClient();
  const { data: invoice } = await supabase.from('payment_invoices').select('id, type, status').eq('id', parsed.data.invoice_id).maybeSingle();
  if (!invoice) return { success: false, error: 'Tagihan tidak ditemukan.', code: 'NOT_FOUND' };
  const settings = await getPaymentSettings();
  if (!isPayable(settings, invoice.type)) {
    return { success: false, error: 'Pembayaran untuk jenis tagihan ini belum dibuka sekolah.', code: 'FORBIDDEN' };
  }

  let path: string;
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploaded = await uploadStorageFile(
      'payment-files',
      `${parsed.data.invoice_id}/${randomUUID()}-${safeName}`,
      await file.arrayBuffer(),
      file.name,
      file.type,
      file.size
    );
    path = uploaded.path;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah bukti.', code: 'STORAGE_ERROR' };
  }

  const { data, error } = await supabase.rpc('submit_payment_proof', {
    p_invoice_id: parsed.data.invoice_id,
    p_file_path: path,
    p_amount: parsed.data.amount,
    p_transfer_date: parsed.data.transfer_date,
    p_sender_name: parsed.data.sender_name,
    p_sender_bank: parsed.data.sender_bank,
    p_notes: parsed.data.notes ?? '',
  });
  if (error || !data) {
    await deleteStorageFile('payment-files', path).catch(() => {});
    return dbError(error, 'Gagal mengirim bukti pembayaran.');
  }
  revalidateDashboards();
  return { success: true, data: { id: data as string }, message: 'Bukti pembayaran terkirim. Menunggu verifikasi sekolah.' };
}

/** Signed URL bukti transfer (5 menit); akses dibuktikan dengan membaca baris lewat RLS. */
export async function getPaymentProofUrlAction(proofId: string): Promise<ActionResult<{ url: string }>> {
  await requireUser();
  if (!uuid.safeParse(proofId).success) return { success: false, error: 'Bukti tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data } = await supabase.from('payment_proofs').select('file_path').eq('id', proofId).maybeSingle();
  if (!data?.file_path) return { success: false, error: 'Bukti tidak ditemukan atau Anda tidak memiliki akses.', code: 'NOT_FOUND' };
  try {
    return { success: true, data: { url: await createAdminSignedUrl('payment-files', data.file_path, 300) } };
  } catch {
    return { success: false, error: 'Bukti tidak dapat dibuka saat ini.', code: 'STORAGE_ERROR' };
  }
}

// ============================================================================
// STAF KEUANGAN: VERIFIKASI & TUNAI (otorisasi final di fungsi database)
// ============================================================================

export async function approvePaymentProofAction(input: ReviewProofInput): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin', 'guru']);
  const parsed = reviewProofSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_payment_proof', { p_proof_id: parsed.data.proof_id, p_notes: parsed.data.notes ?? '' });
  if (error) return dbError(error, 'Gagal menyetujui pembayaran.');
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Pembayaran disetujui. Tagihan lunas dan kuitansi terbit.' };
}

export async function rejectPaymentProofAction(input: RejectProofInput): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin', 'guru']);
  const parsed = rejectProofSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_payment_proof', { p_proof_id: parsed.data.proof_id, p_reason: parsed.data.reason });
  if (error) return dbError(error, 'Gagal menolak bukti pembayaran.');
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Bukti ditolak. Wali dapat mengunggah ulang.' };
}

export async function recordCashPaymentAction(input: CashPaymentInput): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin', 'guru']);
  const parsed = cashPaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_cash_payment', { p_invoice_id: parsed.data.invoice_id, p_notes: parsed.data.notes ?? '' });
  if (error) return dbError(error, 'Gagal mencatat pembayaran tunai.');
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Pembayaran tunai dicatat. Tagihan lunas dan kuitansi terbit.' };
}

// ============================================================================
// SUPER ADMIN: PENGATURAN
// ============================================================================

export async function updatePaymentSettingsAction(input: PaymentSettingsInput): Promise<ActionResult<void>> {
  await requireRole(['super_admin']);
  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data: existing } = await supabase.from('payment_settings').select('id').order('created_at').limit(1).maybeSingle();
  const { error } = existing
    ? await supabase.from('payment_settings').update(parsed.data).eq('id', existing.id)
    : await supabase.from('payment_settings').insert(parsed.data);
  if (error) return dbError(error, 'Gagal menyimpan pengaturan pembayaran.');
  await writeAudit('update_payment_settings', 'payment_settings', existing?.id ?? null, {
    is_enabled: parsed.data.is_enabled,
    manual_transfer_enabled: parsed.data.manual_transfer_enabled,
    bank_accounts: parsed.data.bank_accounts.length,
  });
  revalidateDashboards();
  return { success: true, data: undefined, message: 'Pengaturan pembayaran disimpan.' };
}
