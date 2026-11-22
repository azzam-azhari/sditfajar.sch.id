import { createClient } from '@/lib/supabase/server';
import { classroomOf, getInvoices } from '@/lib/data/payment';
import { jakartaMonth } from '@/lib/date';
import { FinanceConsole, type FinanceInvoice } from './finance-console';

/** Data dan konsol keuangan bersama untuk admin (/dashboard/admin/tagihan) dan bendahara (/dashboard/guru/keuangan). */
export async function FinanceConsoleSection({ canManageInvoices }: { canManageInvoices: boolean }) {
  const supabase = await createClient();
  const [invoices, { data: classrooms }, { data: students }] = await Promise.all([
    getInvoices(),
    supabase
      .from('classrooms')
      .select('id, name, academic_years!inner(is_active)')
      .eq('academic_years.is_active', true)
      .order('name'),
    canManageInvoices
      ? supabase.from('students').select('id, nis, profiles(name)').eq('is_active', true).order('nis')
      : Promise.resolve({ data: [] }),
  ]);

  const rows: FinanceInvoice[] = invoices.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    type: i.type,
    title: i.title,
    amount: i.amount,
    due_date: i.due_date,
    status: i.status,
    created_at: i.created_at,
    marketplace_order_id: i.marketplace_order_id,
    studentName: i.students?.profiles?.name ?? '-',
    nis: i.students?.nis ?? '-',
    classroom: classroomOf(i),
    proofs: i.payment_proofs,
  }));
  const [year, month] = jakartaMonth().split('-').map(Number);

  return (
    <FinanceConsole
      invoices={rows}
      canManageInvoices={canManageInvoices}
      classrooms={(classrooms ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
      students={((students ?? []) as unknown as { id: string; nis: string; profiles: { name: string } | null }[]).map((s) => ({
        id: s.id,
        label: `${s.profiles?.name ?? '-'} (${s.nis})`,
      }))}
      defaultMonth={month}
      defaultYear={year}
    />
  );
}
