import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getParentChildren } from '@/lib/data/lms';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { ShopClient, type ShopProduct, type ParentOrder } from './_components/shop-client';

export const instant = false;

export default async function WaliMarketplacePage() {
  const { user } = await requireRole(['wali_murid']);
  const children = await getParentChildren(user.id);
  const supabase = await createClient();
  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase
      .from('marketplace_products')
      .select('id, title, description, price, product_type, stock, cover_url')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('marketplace_orders')
      .select('id, order_number, status, total_amount, created_at, students(profiles(name)), marketplace_order_items(product_id, quantity, unit_price, marketplace_products(title, product_type)), payment_invoices(status, due_date)')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace Sekolah"
        description="Pesan buku, modul digital, dan perlengkapan sekolah untuk anak Anda. Harga dihitung ulang oleh server. Barang fisik diambil di sekolah dan berkas digital dapat diunduh setelah tagihan lunas."
      />
      {children.length === 0 ? (
        <EmptyState title="Belum ada anak terhubung" description="Pemesanan memerlukan data anak yang terhubung ke akun Anda." />
      ) : (
        <ShopClient
          products={((products ?? []) as unknown as ShopProduct[]).map((p) => ({ ...p, price: Number(p.price) }))}
          orders={((orders ?? []) as unknown as ParentOrder[]).map((o) => ({ ...o, total_amount: Number(o.total_amount) }))}
          childrenList={children.map((c) => ({ id: c.studentId, name: c.name }))}
        />
      )}
    </div>
  );
}
