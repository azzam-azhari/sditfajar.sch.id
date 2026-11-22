import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';

export const MARKETPLACE_CACHE_TAG = 'marketplace-products';

export interface PublicProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  product_type: 'physical' | 'digital';
  stock: number | null;
  cover_url: string | null;
}

/** Katalog produk terpublikasi (anon client + RLS `is_published = true`), di-cache dan di-invalidate saat katalog berubah. */
export async function getPublishedProducts(): Promise<PublicProduct[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(MARKETPLACE_CACHE_TAG);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('marketplace_products')
    .select('id, title, description, price, product_type, stock, cover_url')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Marketplace] Gagal memuat katalog:', error.message);
    return [];
  }
  return (data ?? []).map((p) => ({ ...p, price: Number(p.price) })) as PublicProduct[];
}

export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}
