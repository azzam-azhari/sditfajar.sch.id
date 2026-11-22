import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { getTeacherContext } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { FinanceConsoleSection } from '@/components/finance/finance-page';

export const instant = false;

export default async function GuruKeuanganPage() {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  // Fitur berbasis jabatan: hanya bendahara.
  if (!ctx?.positions.includes('bendahara')) redirect('/dashboard/guru');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Keuangan Sekolah"
        description="Khusus jabatan bendahara: verifikasi bukti transfer wali murid dan catat pembayaran tunai. Pembuatan tagihan dilakukan admin."
      />
      <FinanceConsoleSection canManageInvoices={false} />
    </div>
  );
}
