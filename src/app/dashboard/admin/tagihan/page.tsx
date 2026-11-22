import { requireRole } from '@/lib/supabase/auth-helpers';
import { PageHeader } from '@/components/common/page-header';
import { FinanceConsoleSection } from '@/components/finance/finance-page';

export const instant = false;

export default async function AdminTagihanPage() {
  await requireRole(['admin', 'super_admin']);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tagihan & Pembayaran"
        description="Buat tagihan SPP, iuran, dan daftar ulang; verifikasi bukti transfer wali murid; catat pembayaran tunai. Status lunas hanya terjadi lewat verifikasi atau pencatatan tunai."
      />
      <FinanceConsoleSection canManageInvoices />
    </div>
  );
}
