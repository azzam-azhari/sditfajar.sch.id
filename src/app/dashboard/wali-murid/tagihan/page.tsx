import { requireRole } from '@/lib/supabase/auth-helpers';
import { getParentChildren } from '@/lib/data/lms';
import { classroomOf, getInvoices, getPaymentSettings, isPayable } from '@/lib/data/payment';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ParentBillingClient, type ParentInvoice } from './_components/parent-billing-client';

export const instant = false;

export default async function WaliTagihanPage() {
  const { user } = await requireRole(['wali_murid']);
  const children = await getParentChildren(user.id);
  if (children.length === 0) {
    return <EmptyState title="Belum ada anak terhubung" description="Hubungi admin sekolah untuk menautkan data anak ke akun Anda." />;
  }
  const [invoices, settings] = await Promise.all([
    getInvoices({ studentIds: children.map((c) => c.studentId) }),
    getPaymentSettings(),
  ]);

  const rows: ParentInvoice[] = invoices
    .filter((i) => i.status !== 'draft')
    .map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      type: i.type,
      title: i.title,
      amount: i.amount,
      due_date: i.due_date,
      status: i.status,
      studentName: i.students?.profiles?.name ?? '-',
      classroom: classroomOf(i)?.name ?? '-',
      payable: isPayable(settings, i.type),
      lastProof: i.payment_proofs[0] ?? null,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tagihan & Pembayaran"
        description="Bayar dengan transfer ke rekening sekolah lalu unggah bukti transfer. Petugas keuangan akan memverifikasi, lalu kuitansi resmi dapat dicetak."
      />
      <ParentBillingClient
        invoices={rows}
        bankAccounts={settings.bank_accounts}
        instructions={settings.manual_instructions}
        paymentOpen={settings.is_enabled && settings.manual_transfer_enabled}
      />
    </div>
  );
}
