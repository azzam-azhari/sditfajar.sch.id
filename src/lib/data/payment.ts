import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { BankAccount } from '@/validations/payment.schema';

export interface PaymentSettingsView {
  id: string | null;
  is_enabled: boolean;
  manual_transfer_enabled: boolean;
  is_spp_enabled: boolean;
  is_iuran_enabled: boolean;
  is_pendaftaran_semester_enabled: boolean;
  is_marketplace_enabled: boolean;
  bank_accounts: BankAccount[];
  manual_instructions: string | null;
}

const DEFAULT_SETTINGS: PaymentSettingsView = {
  id: null,
  is_enabled: false,
  manual_transfer_enabled: true,
  is_spp_enabled: false,
  is_iuran_enabled: false,
  is_pendaftaran_semester_enabled: false,
  is_marketplace_enabled: false,
  bank_accounts: [],
  manual_instructions: null,
};

/**
 * Pengaturan pembayaran. Tabel payment_settings khusus super admin (RLS), jadi
 * dibaca dengan admin client dan HANYA kolom publik (bukan kunci gateway) yang dikembalikan.
 */
export async function getPaymentSettings(): Promise<PaymentSettingsView> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('payment_settings')
    .select('id, is_enabled, manual_transfer_enabled, is_spp_enabled, is_iuran_enabled, is_pendaftaran_semester_enabled, is_marketplace_enabled, bank_accounts, manual_instructions')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...data, bank_accounts: (data.bank_accounts ?? []) as BankAccount[] };
}

/** Apakah jenis tagihan ini sedang dibuka untuk dibayar oleh wali. */
export function isPayable(settings: PaymentSettingsView, type: string): boolean {
  if (!settings.is_enabled || !settings.manual_transfer_enabled) return false;
  switch (type) {
    case 'spp':
      return settings.is_spp_enabled;
    case 'iuran_ekstrakurikuler':
    case 'lainnya':
      return settings.is_iuran_enabled;
    case 'pendaftaran_semester_ganjil':
    case 'pendaftaran_semester_genap':
      return settings.is_pendaftaran_semester_enabled;
    case 'marketplace':
      return settings.is_marketplace_enabled;
    default:
      return false;
  }
}

export interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  type: string;
  title: string;
  amount: number;
  due_date: string | null;
  billing_month: number | null;
  billing_year: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  student_id: string | null;
  marketplace_order_id: string | null;
  students: { nis: string; profiles: { name: string } | null; class_students: { status: string; left_at: string | null; classrooms: { id: string; name: string } | null }[] } | null;
  payment_proofs: {
    id: string;
    status: string;
    amount: number;
    transfer_date: string;
    sender_name: string;
    sender_bank: string;
    notes: string | null;
    review_notes: string | null;
    created_at: string;
  }[];
}

export const INVOICE_SELECT =
  'id, invoice_number, type, title, amount, due_date, billing_month, billing_year, status, notes, created_at, student_id, marketplace_order_id, students(nis, profiles(name), class_students(status, left_at, classrooms(id, name))), payment_proofs(id, status, amount, transfer_date, sender_name, sender_bank, notes, review_notes, created_at)';

/** Tagihan yang terlihat oleh pengguna (RLS: staf keuangan semua, wali anaknya, murid dirinya). */
export async function getInvoices(filter?: { studentIds?: string[] }): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  let query = supabase.from('payment_invoices').select(INVOICE_SELECT).order('created_at', { ascending: false });
  if (filter?.studentIds) {
    if (filter.studentIds.length === 0) return [];
    query = query.in('student_id', filter.studentIds);
  }
  const { data } = await query;
  return ((data ?? []) as unknown as InvoiceRow[]).map((i) => ({
    ...i,
    amount: Number(i.amount),
    payment_proofs: (i.payment_proofs ?? [])
      .map((p) => ({ ...p, amount: Number(p.amount) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }));
}

export function classroomOf(row: InvoiceRow): { id: string; name: string } | null {
  const active = row.students?.class_students?.find((c) => c.status === 'active' && !c.left_at);
  return active?.classrooms ?? null;
}
