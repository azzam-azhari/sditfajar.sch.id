'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAdminSignedUrl, deleteStorageFile, uploadStorageFile } from '@/lib/supabase/storage';
import { dbError, revalidateDashboards, validationError, writeAudit } from '@/lib/actions/helpers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { MARKETPLACE_CACHE_TAG } from '@/lib/data/marketplace';
import type { ActionResult } from '@/types/action.types';
import {
  checkoutSchema, productSchema, productUpdateSchema,
  type CheckoutInput, type ProductInput, type ProductUpdateInput,
} from '@/validations/fase6.schema';

const uuid = z.guid();

function hasFile(file: File | null): file is File {
  return Boolean(file && file.size > 0);
}

function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'produk'}-${id.slice(0, 6)}`;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function uploadCover(file: File, productId: string): Promise<{ cover_url: string; cover_path: string }> {
  const path = `marketplace/${productId}/${randomUUID()}-${safeName(file.name)}`;
  const res = await uploadStorageFile('images', path, await file.arrayBuffer(), file.name, file.type, file.size);
  return { cover_url: res.publicUrl ?? '', cover_path: res.path };
}

async function uploadDigital(file: File, productId: string): Promise<string> {
  const path = `${productId}/${randomUUID()}-${safeName(file.name)}`;
  const res = await uploadStorageFile('marketplace-files', path, await file.arrayBuffer(), file.name, file.type, file.size);
  return res.path;
}

async function removeFile(bucket: 'images' | 'marketplace-files', path: string | null | undefined) {
  if (!path) return;
  await deleteStorageFile(bucket, path).catch((err) =>
    console.warn('[Marketplace] Gagal menghapus berkas lama:', err instanceof Error ? err.message : err)
  );
}

function revalidateMarketplace() {
  revalidateDashboards();
  revalidatePath('/marketplace');
  revalidateTag(MARKETPLACE_CACHE_TAG, 'max');
}

// ============================================================================
// ADMIN: KATALOG PRODUK
// ============================================================================

export async function createProductAction(
  input: ProductInput,
  cover: File | null,
  digitalFile: File | null
): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireRole(['admin', 'super_admin']);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  if (parsed.data.product_type === 'digital' && !hasFile(digitalFile)) {
    return { success: false, error: 'Produk digital wajib memiliki berkas (PDF/EPUB).', code: 'VALIDATION_ERROR' };
  }

  const id = randomUUID();
  let coverValues: { cover_url: string; cover_path: string } | null = null;
  let filePath: string | null = null;
  try {
    if (hasFile(cover)) coverValues = await uploadCover(cover, id);
    if (parsed.data.product_type === 'digital' && hasFile(digitalFile)) filePath = await uploadDigital(digitalFile, id);
  } catch (err) {
    await removeFile('images', coverValues?.cover_path);
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('marketplace_products').insert({
    id,
    ...parsed.data,
    stock: parsed.data.product_type === 'physical' ? parsed.data.stock : null,
    slug: slugify(parsed.data.title, id),
    cover_url: coverValues?.cover_url ?? null,
    cover_path: coverValues?.cover_path ?? null,
    file_path: filePath,
    created_by: user.id,
  });
  if (error) {
    await removeFile('images', coverValues?.cover_path);
    await removeFile('marketplace-files', filePath);
    return dbError(error, 'Gagal menyimpan produk.');
  }
  await writeAudit('create_marketplace_product', 'marketplace_products', id, { price: parsed.data.price, type: parsed.data.product_type });
  revalidateMarketplace();
  return { success: true, data: { id }, message: 'Produk berhasil disimpan.' };
}

export async function updateProductAction(
  input: ProductUpdateInput,
  cover: File | null,
  digitalFile: File | null
): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin']);
  const parsed = productUpdateSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const { id, remove_file, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('marketplace_products')
    .select('cover_path, file_path')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return { success: false, error: 'Produk tidak ditemukan.', code: 'NOT_FOUND' };

  let coverValues: { cover_url: string; cover_path: string } | null = null;
  let newFile: string | null = null;
  try {
    if (hasFile(cover)) coverValues = await uploadCover(cover, id);
    if (fields.product_type === 'digital' && hasFile(digitalFile)) newFile = await uploadDigital(digitalFile, id);
  } catch (err) {
    await removeFile('images', coverValues?.cover_path);
    return { success: false, error: err instanceof Error ? err.message : 'Gagal mengunggah berkas.', code: 'STORAGE_ERROR' };
  }
  const filePath =
    fields.product_type === 'digital' ? newFile ?? (remove_file ? null : existing.file_path) : null;
  if (fields.product_type === 'digital' && !filePath) {
    await removeFile('images', coverValues?.cover_path);
    return { success: false, error: 'Produk digital wajib memiliki berkas (PDF/EPUB).', code: 'VALIDATION_ERROR' };
  }

  const { error } = await supabase
    .from('marketplace_products')
    .update({
      ...fields,
      stock: fields.product_type === 'physical' ? fields.stock : null,
      file_path: filePath,
      ...(coverValues ?? {}),
    })
    .eq('id', id);
  if (error) {
    await removeFile('images', coverValues?.cover_path);
    await removeFile('marketplace-files', newFile);
    return dbError(error, 'Gagal memperbarui produk.');
  }
  if (coverValues && existing.cover_path) await removeFile('images', existing.cover_path);
  if (existing.file_path && existing.file_path !== filePath) await removeFile('marketplace-files', existing.file_path);
  await writeAudit('update_marketplace_product', 'marketplace_products', id, { price: fields.price, published: fields.is_published });
  revalidateMarketplace();
  return { success: true, data: undefined, message: 'Produk diperbarui.' };
}

export async function deleteProductAction(id: string): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin']);
  if (!uuid.safeParse(id).success) return { success: false, error: 'Produk tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { count } = await supabase
    .from('marketplace_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id);
  if ((count ?? 0) > 0) {
    return { success: false, error: 'Produk sudah pernah dipesan dan tidak dapat dihapus. Nonaktifkan publikasinya.', code: 'FORBIDDEN' };
  }
  const { data, error } = await supabase.from('marketplace_products').delete().eq('id', id).select('cover_path, file_path');
  if (error) return dbError(error, 'Gagal menghapus produk.');
  if (!data?.length) return { success: false, error: 'Produk tidak ditemukan.', code: 'NOT_FOUND' };
  await removeFile('images', data[0].cover_path);
  await removeFile('marketplace-files', data[0].file_path);
  await writeAudit('delete_marketplace_product', 'marketplace_products', id, {});
  revalidateMarketplace();
  return { success: true, data: undefined, message: 'Produk dihapus.' };
}

/** Tandai pesanan sudah diambil di sekolah; hanya untuk pesanan yang tagihannya lunas. */
export async function markOrderFulfilledAction(orderId: string): Promise<ActionResult<void>> {
  await requireRole(['admin', 'super_admin']);
  if (!uuid.safeParse(orderId).success) return { success: false, error: 'Pesanan tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { data: order } = await supabase
    .from('marketplace_orders')
    .select('id, status, payment_invoices(status)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { success: false, error: 'Pesanan tidak ditemukan.', code: 'NOT_FOUND' };
  const invoices = (order.payment_invoices ?? []) as { status: string }[];
  if (!invoices.some((i) => i.status === 'paid')) {
    return { success: false, error: 'Pesanan belum lunas. Barang hanya dapat diserahkan setelah pembayaran terverifikasi.', code: 'FORBIDDEN' };
  }
  if (order.status === 'fulfilled') return { success: false, error: 'Pesanan sudah ditandai diambil.', code: 'DUPLICATE_ENTRY' };
  const { error } = await supabase
    .from('marketplace_orders')
    .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return dbError(error, 'Gagal memperbarui pesanan.');
  await writeAudit('fulfill_marketplace_order', 'marketplace_orders', orderId, {});
  revalidateMarketplace();
  return { success: true, data: undefined, message: 'Pesanan ditandai sudah diambil.' };
}

// ============================================================================
// WALI MURID: CHECKOUT & UNDUHAN
// ============================================================================

export async function checkoutAction(input: CheckoutInput): Promise<ActionResult<{ orderId: string }>> {
  await requireRole(['wali_murid']);
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  // Harga, stok, dan total dihitung ulang di database (price snapshot); harga dari klien tidak dikirim.
  const { data, error } = await supabase.rpc('create_marketplace_order', {
    p_student_id: parsed.data.student_id,
    p_items: parsed.data.items,
  });
  if (error || !data) return dbError(error, 'Gagal membuat pesanan.');
  revalidateMarketplace();
  return { success: true, data: { orderId: data as string }, message: 'Pesanan dibuat. Tagihan menunggu pembayaran.' };
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult<void>> {
  await requireRole(['wali_murid', 'admin', 'super_admin']);
  if (!uuid.safeParse(orderId).success) return { success: false, error: 'Pesanan tidak valid.', code: 'VALIDATION_ERROR' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_marketplace_order', { p_order_id: orderId });
  if (error) return dbError(error, 'Gagal membatalkan pesanan.');
  revalidateMarketplace();
  return { success: true, data: undefined, message: 'Pesanan dibatalkan.' };
}

/** Signed URL berkas digital (5 menit), hanya untuk pesanan milik wali yang tagihannya lunas. */
export async function getProductDownloadUrlAction(orderId: string, productId: string): Promise<ActionResult<{ url: string }>> {
  await requireRole(['wali_murid']);
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(productId).success) {
    return { success: false, error: 'Permintaan tidak valid.', code: 'VALIDATION_ERROR' };
  }
  const supabase = await createClient();
  // Dibaca lewat RLS: hanya pesanan milik wali ini yang terlihat.
  const { data: order } = await supabase
    .from('marketplace_orders')
    .select('id, payment_invoices(status), marketplace_order_items(product_id)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { success: false, error: 'Pesanan tidak ditemukan.', code: 'NOT_FOUND' };
  const paid = ((order.payment_invoices ?? []) as { status: string }[]).some((i) => i.status === 'paid');
  if (!paid) return { success: false, error: 'Berkas digital dapat diunduh setelah tagihan lunas.', code: 'FORBIDDEN' };
  const items = (order.marketplace_order_items ?? []) as { product_id: string }[];
  if (!items.some((i) => i.product_id === productId)) {
    return { success: false, error: 'Produk tidak ada dalam pesanan ini.', code: 'FORBIDDEN' };
  }
  const admin = createAdminClient();
  const { data: product } = await admin
    .from('marketplace_products')
    .select('file_path, product_type')
    .eq('id', productId)
    .maybeSingle();
  if (!product?.file_path || product.product_type !== 'digital') {
    return { success: false, error: 'Produk ini tidak memiliki berkas digital.', code: 'NOT_FOUND' };
  }
  try {
    const url = await createAdminSignedUrl('marketplace-files', product.file_path, 300);
    return { success: true, data: { url } };
  } catch {
    return { success: false, error: 'Berkas tidak dapat dibuka saat ini.', code: 'STORAGE_ERROR' };
  }
}
