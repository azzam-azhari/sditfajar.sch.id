import { requireRole } from '@/lib/supabase/auth-helpers';
import { getPaymentSettings } from '@/lib/data/payment';
import { PageHeader } from '@/components/common/page-header';
import { PaymentSettingsForm } from './_components/payment-settings-form';

export const instant = false;

export default async function PaymentSettingsPage() {
  await requireRole(['super_admin']);
  const settings = await getPaymentSettings();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Pembayaran"
        description="Pembayaran memakai transfer manual dengan unggah bukti dan verifikasi admin/bendahara, atau tunai di sekolah. Payment gateway (Midtrans) ditunda."
      />
      <PaymentSettingsForm initial={settings} />
    </div>
  );
}
