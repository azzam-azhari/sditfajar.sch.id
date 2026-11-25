'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Download, Lock, Minus, Plus, ShoppingCart, XCircle } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionCard } from '@/components/lms/section-card';
import { cancelOrderAction, checkoutAction, getProductDownloadUrlAction } from '@/actions/marketplace.actions';
import { INVOICE_LABEL, INVOICE_VARIANT, ORDER_LABEL, ORDER_VARIANT, rupiah } from '@/components/lms/marketplace-labels';
import { formatDate, formatDateTime } from '@/lib/date';

export interface ShopProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  product_type: 'physical' | 'digital';
  stock: number | null;
  cover_url: string | null;
}

export interface ParentOrder {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  students: { profiles: { name: string } | null } | null;
  marketplace_order_items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    marketplace_products: { title: string; product_type: string } | null;
  }[];
  payment_invoices: { status: string; due_date: string | null }[];
}

export function ShopClient({
  products,
  orders,
  childrenList,
}: {
  products: ShopProduct[];
  orders: ParentOrder[];
  childrenList: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [childId, setChildId] = React.useState(childrenList[0]?.id ?? '');

  const maxFor = (p: ShopProduct) => (p.product_type === 'digital' ? 1 : p.stock === null ? 100 : Math.min(p.stock, 100));
  const change = (p: ShopProduct, delta: number) =>
    setCart((c) => {
      const next = Math.max(0, Math.min(maxFor(p), (c[p.id] ?? 0) + delta));
      const copy = { ...c };
      if (next === 0) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((i): i is { product: ShopProduct; qty: number } => Boolean(i.product));
  // Perkiraan saja; total resmi dihitung ulang oleh server saat checkout.
  const estimate = cartItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(res.message);
        after?.();
        router.refresh();
      } else toast.error(res.error);
    });

  const checkout = () =>
    run(
      () =>
        checkoutAction({
          student_id: childId,
          items: cartItems.map((i) => ({ product_id: i.product.id, quantity: i.qty })),
        }),
      () => setCart({})
    );

  const download = (orderId: string, productId: string) => {
    const win = window.open('about:blank', '_blank');
    startTransition(async () => {
      const res = await getProductDownloadUrlAction(orderId, productId);
      if (res.success) {
        if (win) win.location.href = res.data.url;
        else window.open(res.data.url, '_blank', 'noopener,noreferrer');
      } else {
        win?.close();
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          {products.length === 0 && (
            <div className="sm:col-span-2 rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
              Katalog belum tersedia.
            </div>
          )}
          {products.map((p) => {
            const soldOut = p.product_type === 'physical' && p.stock !== null && p.stock <= 0;
            return (
              <div key={p.id} className="rounded-xl border border-border/80 bg-card p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  {p.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt={p.title} className="h-32 w-full rounded-lg border border-border/60 object-cover" />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                    <StatusBadge status={p.product_type === 'digital' ? 'Digital' : 'Fisik'} variant="neutral" size="sm" />
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-3">{p.description}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm font-bold text-primary">{rupiah(p.price)}</div>
                    {p.product_type === 'physical' && (
                      <div className="text-[11px] text-muted-foreground">
                        {p.stock === null ? 'Stok tersedia' : soldOut ? 'Stok habis' : `Stok ${p.stock}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label={`Kurangi ${p.title}`} onClick={() => change(p, -1)} disabled={!cart[p.id]}>
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center font-mono text-xs">{cart[p.id] ?? 0}</span>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" aria-label={`Tambah ${p.title}`} onClick={() => change(p, 1)} disabled={soldOut || (cart[p.id] ?? 0) >= maxFor(p)}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <SectionCard title="Keranjang" description="Total resmi dihitung ulang oleh server saat pesanan dibuat.">
          {cartItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keranjang masih kosong.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {cartItems.map((i) => (
                <li key={i.product.id} className="flex justify-between gap-2">
                  <span>{i.qty}× {i.product.title}</span>
                  <span className="font-mono">{rupiah(i.product.price * i.qty)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-border/60 pt-1.5 font-semibold">
                <span>Perkiraan total</span>
                <span className="font-mono">{rupiah(estimate)}</span>
              </li>
            </ul>
          )}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Untuk anak</span>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger className="h-9 w-full text-xs" aria-label="Pilih anak"><SelectValue /></SelectTrigger>
              <SelectContent>
                {childrenList.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-9 w-full text-xs" disabled={isPending || cartItems.length === 0 || !childId} onClick={checkout}>
            <ShoppingCart className="size-3.5" /> {isPending ? 'Memproses…' : 'Buat Pesanan'}
          </Button>
        </SectionCard>
      </div>

      <SectionCard
        title="Pesanan Saya"
        description="Bayar tagihan pesanan di menu Tagihan & Pembayaran (transfer lalu unggah bukti) atau tunai di sekolah. Unduhan berkas digital aktif setelah tagihan lunas."
      >
        <ZebraDataTable<ParentOrder>
          data={orders}
          keyExtractor={(o) => o.id}
          emptyText="Belum ada pesanan."
          mobileCards
          columns={[
            {
              header: 'Pesanan',
              cardSlot: 'title',
              cell: (o) => (
                <div className="space-y-0.5">
                  <div className="font-mono text-xs font-semibold">{o.order_number ?? o.id.slice(0, 8)}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDateTime(o.created_at)} · {o.students?.profiles?.name ?? '-'}</div>
                </div>
              ),
            },
            {
              header: 'Item',
              cardSlot: 'full',
              cell: (o) => {
                const paid = o.payment_invoices.some((i) => i.status === 'paid');
                return (
                  <ul className="space-y-1 text-xs">
                    {o.marketplace_order_items.map((i) => (
                      <li key={i.product_id} className="flex flex-wrap items-center gap-1.5">
                        <span>{i.quantity}× {i.marketplace_products?.title ?? '-'}</span>
                        {i.marketplace_products?.product_type === 'digital' &&
                          (paid ? (
                            <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => download(o.id, i.product_id)} disabled={isPending}>
                              <Download className="size-3" /> Unduh
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Lock className="size-3" /> terkunci sampai lunas
                            </span>
                          ))}
                      </li>
                    ))}
                  </ul>
                );
              },
            },
            { header: 'Total', isMono: true, align: 'right', cell: (o) => rupiah(o.total_amount) },
            { header: 'Status', cell: (o) => <StatusBadge status={ORDER_LABEL[o.status] ?? o.status} variant={ORDER_VARIANT[o.status] ?? 'neutral'} size="sm" /> },
            {
              header: 'Tagihan',
              cell: (o) => {
                const inv = o.payment_invoices[0];
                return inv ? (
                  <div className="space-y-0.5">
                    <StatusBadge status={INVOICE_LABEL[inv.status] ?? inv.status} variant={INVOICE_VARIANT[inv.status] ?? 'neutral'} size="sm" />
                    {inv.due_date && inv.status === 'unpaid' && (
                      <div className="text-[11px] text-muted-foreground">Jatuh tempo {formatDate(inv.due_date)}</div>
                    )}
                  </div>
                ) : (
                  '-'
                );
              },
            },
            {
              header: 'Aksi',
              align: 'right',
              cardSlot: 'footer',
              cell: (o) => {
                const invStatus = o.payment_invoices[0]?.status;
                const canPay = o.status === 'pending_payment' && (invStatus === 'unpaid' || invStatus === 'failed');
                const processing = o.status === 'pending_payment' && invStatus === 'pending';
                if (o.status !== 'pending_payment') return <span className="text-xs text-muted-foreground">—</span>;
                return (
                  <div className="flex justify-end gap-1">
                    {(canPay || processing) && (
                      <Button asChild size="sm" variant={canPay ? 'default' : 'outline'} className="h-7 text-xs">
                        <Link href="/dashboard/wali-murid/tagihan">
                          <CreditCard className="size-3.5" /> {canPay ? 'Bayar' : 'Lihat tagihan'}
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={isPending} onClick={() => run(() => cancelOrderAction(o.id))}>
                      <XCircle className="size-3.5" /> Batalkan
                    </Button>
                  </div>
                );
              },
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}
