import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/common/page-header';
import { MarketplaceAdmin, type ProductRow, type OrderRow } from './_components/marketplace-admin';

export const instant = false;

export default async function MarketplaceAdminPage() {
  await requireRole(['admin', 'super_admin']);
  const supabase = await createClient();
  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase
      .from('marketplace_products')
      .select('id, title, description, price, product_type, stock, is_published, cover_url, file_path, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('marketplace_orders')
      .select(
        'id, order_number, status, total_amount, created_at, fulfilled_at, parents(profiles(name)), students(nis, profiles(name)), marketplace_order_items(quantity, unit_price, marketplace_products(title, product_type)), payment_invoices(status, due_date, invoice_number, payment_proofs(status))'
      )
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace Sekolah"
        description="Kelola katalog buku, modul digital, dan perlengkapan. Pesanan dibuat wali murid; barang fisik diserahkan di sekolah setelah tagihan lunas, berkas digital terbuka otomatis setelah lunas."
      />
      <MarketplaceAdmin
        products={((products ?? []) as unknown as ProductRow[]).map((p) => ({ ...p, price: Number(p.price) }))}
        orders={((orders ?? []) as unknown as OrderRow[]).map((o) => ({ ...o, total_amount: Number(o.total_amount) }))}
      />
    </div>
  );
}
