import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rupiah } from '@/components/lms/marketplace-labels';
import { INVOICE_TYPE_LABELS } from '@/validations/payment.schema';
import { formatDateTime } from '@/lib/date';
import { PrintButton } from './print-button';

export const instant = false;

type ReceiptRow = {
  id: string;
  invoice_number: string;
  student_name: string;
  class_name: string | null;
  amount: number;
  paid_at: string;
  payer_bank_name: string | null;
  payer_bank_account_name: string | null;
  school_logo_url: string | null;
  payment_invoices: { title: string; type: string; marketplace_order_id: string | null; billing_month: number | null; billing_year: number | null; students: { nis: string } | null } | null;
  payment_transactions: { provider: string; order_id: string; raw_payload: { recorded_by?: string; notes?: string | null } | null } | null;
};

/**
 * Kuitansi resmi. Akses dijaga RLS payment_receipts: hanya wali murid pemilik
 * tagihan dan staf keuangan (admin, super admin, bendahara). Selain itu 404.
 */
export default async function ReceiptPage(props: { params: Promise<{ invoiceId: string }> }) {
  await requireRole(['wali_murid', 'admin', 'super_admin', 'guru']);
  const { invoiceId } = await props.params;
  if (!z.guid().safeParse(invoiceId).success) notFound();

  const supabase = await createClient();
  const [{ data }, { data: school }] = await Promise.all([
    supabase
      .from('payment_receipts')
      .select(
        'id, invoice_number, student_name, class_name, amount, paid_at, payer_bank_name, payer_bank_account_name, school_logo_url, payment_invoices(title, type, marketplace_order_id, billing_month, billing_year, students(nis)), payment_transactions(provider, order_id, raw_payload)'
      )
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('school_settings').select('school_name, address, phone, email, logo_url').limit(1).maybeSingle(),
  ]);
  if (!data) notFound();
  const receipt = data as unknown as ReceiptRow;

  // Akses kuitansi sudah lolos RLS di atas. Nama petugas dibaca lewat admin client
  // karena RLS profiles tidak mengizinkan wali membaca profil staf.
  const recorderId = receipt.payment_transactions?.raw_payload?.recorded_by;
  const { data: recorder } =
    recorderId && z.guid().safeParse(recorderId).success
      ? await createAdminClient().from('profiles').select('name').eq('id', recorderId).maybeSingle()
      : { data: null };

  // Rincian barang untuk tagihan marketplace. Diambil lewat admin client, dibatasi
  // ke pesanan milik tagihan yang kuitansinya sudah lolos RLS (bendahara tidak punya
  // akses baca langsung ke marketplace_order_items).
  type OrderItem = { quantity: number; unit_price: number; marketplace_products: { title: string } | null };
  const orderId = receipt.payment_invoices?.marketplace_order_id;
  const { data: itemRows } = orderId
    ? await createAdminClient()
        .from('marketplace_order_items')
        .select('quantity, unit_price, marketplace_products(title)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
    : { data: null };
  const items = ((itemRows ?? []) as unknown as OrderItem[]).map((i) => ({
    title: i.marketplace_products?.title ?? 'Produk',
    quantity: i.quantity,
    unitPrice: Number(i.unit_price),
  }));

  const method =
    receipt.payment_transactions?.provider === 'cash'
      ? 'Tunai di sekolah'
      : `Transfer manual${receipt.payer_bank_name ? ` · ${receipt.payer_bank_name}` : ''}${receipt.payer_bank_account_name ? ` a.n. ${receipt.payer_bank_account_name}` : ''}`;
  const logo = school?.logo_url ?? receipt.school_logo_url;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <article className="rounded-xl border border-border/80 bg-card p-6 sm:p-10 space-y-6 print:border-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-foreground/80 pb-5">
          <div className="flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo sekolah" className="size-12 object-contain" />
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight">{school?.school_name ?? 'SDIT Fajar'}</h1>
              {school?.address && <p className="text-xs text-muted-foreground">{school.address}</p>}
              <p className="text-[11px] font-mono text-muted-foreground">
                {[school?.phone, school?.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Kuitansi Pembayaran</div>
            <div className="mt-1 inline-block rounded border-2 border-emerald-600 px-2 py-0.5 text-sm font-bold text-emerald-600">LUNAS</div>
          </div>
        </header>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-[11px] text-muted-foreground">No. Tagihan</dt><dd className="font-mono">{receipt.invoice_number}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">No. Transaksi</dt><dd className="font-mono text-xs">{receipt.payment_transactions?.order_id ?? '-'}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">Nama Murid</dt><dd>{receipt.student_name}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">NIS · Kelas</dt><dd className="font-mono">{receipt.payment_invoices?.students?.nis ?? '-'} · {receipt.class_name ?? '-'}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">Tanggal Bayar</dt><dd className="font-mono">{formatDateTime(receipt.paid_at)}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">Metode</dt><dd>{method}</dd></div>
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border/80 bg-muted/60 text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2 text-left">Rincian</th>
              <th className="px-3 py-2 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              <>
                <tr>
                  <td colSpan={2} className="px-3 pt-3 pb-1">
                    {receipt.payment_invoices?.title ?? '-'}
                    <div className="text-[11px] text-muted-foreground">{INVOICE_TYPE_LABELS[receipt.payment_invoices?.type ?? ''] ?? ''}</div>
                  </td>
                </tr>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-1.5">
                      <span className="font-mono">{item.quantity}×</span> {item.title}
                      <div className="text-[11px] text-muted-foreground font-mono">@ {rupiah(item.unitPrice)}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono align-top">{rupiah(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </>
            ) : (
              <tr>
                <td className="px-3 py-3">
                  {receipt.payment_invoices?.title ?? '-'}
                  <div className="text-[11px] text-muted-foreground">{INVOICE_TYPE_LABELS[receipt.payment_invoices?.type ?? ''] ?? ''}</div>
                </td>
                <td className="px-3 py-3 text-right font-mono">{rupiah(Number(receipt.amount))}</td>
              </tr>
            )}
            <tr className="border-t border-border/80 font-semibold">
              <td className="px-3 py-3">Total Dibayar</td>
              <td className="px-3 py-3 text-right font-mono">{rupiah(Number(receipt.amount))}</td>
            </tr>
          </tbody>
        </table>

        <footer className="flex items-end justify-between pt-6 text-xs">
          <p className="max-w-xs text-muted-foreground">
            Kuitansi ini diterbitkan oleh sistem setelah pembayaran diverifikasi petugas keuangan sekolah dan sah tanpa tanda tangan basah.
          </p>
          <div className="text-center">
            <div className="text-muted-foreground">Diverifikasi oleh</div>
            <div className="mt-8 font-semibold">{recorder?.name ?? 'Petugas Keuangan'}</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
