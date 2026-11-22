'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PackageCheck, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  cancelOrderAction, createProductAction, deleteProductAction, markOrderFulfilledAction, updateProductAction,
} from '@/actions/marketplace.actions';
import { formatDateTime } from '@/lib/date';
import { ORDER_LABEL, ORDER_VARIANT, INVOICE_LABEL, INVOICE_VARIANT, rupiah } from '@/components/lms/marketplace-labels';

export interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  product_type: 'physical' | 'digital';
  stock: number | null;
  is_published: boolean;
  cover_url: string | null;
  file_path: string | null;
}

export interface OrderRow {
  id: string;
  order_number: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  fulfilled_at: string | null;
  parents: { profiles: { name: string } | null } | null;
  students: { nis: string; profiles: { name: string } | null } | null;
  marketplace_order_items: { quantity: number; unit_price: number; marketplace_products: { title: string; product_type: string } | null }[];
  payment_invoices: { status: string; due_date: string | null }[];
}

interface FormState {
  id: string | null;
  title: string;
  description: string;
  price: string;
  type: 'physical' | 'digital';
  stock: string;
  published: boolean;
  hasFile: boolean;
}

const blank: FormState = { id: null, title: '', description: '', price: '', type: 'physical', stock: '', published: true, hasFile: false };

export function MarketplaceAdmin({ products, orders }: { products: ProductRow[]; orders: OrderRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(blank);
  const [cover, setCover] = React.useState<File | null>(null);
  const [digital, setDigital] = React.useState<File | null>(null);
  const [toDelete, setToDelete] = React.useState<ProductRow | null>(null);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(res.message);
        after?.();
        router.refresh();
      } else toast.error(res.error);
    });

  const openEdit = (p: ProductRow) => {
    setForm({
      id: p.id, title: p.title, description: p.description ?? '', price: String(p.price), type: p.product_type,
      stock: p.stock?.toString() ?? '', published: p.is_published, hasFile: Boolean(p.file_path),
    });
    setCover(null);
    setDigital(null);
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      product_type: form.type,
      stock: form.type === 'physical' && form.stock !== '' ? Number(form.stock) : null,
      is_published: form.published,
    };
    run(
      () => (form.id ? updateProductAction({ ...payload, id: form.id }, cover, digital) : createProductAction(payload, cover, digital)),
      () => setOpen(false)
    );
  };

  return (
    <Tabs defaultValue="produk" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="produk" className="text-xs">Katalog Produk ({products.length})</TabsTrigger>
          <TabsTrigger value="pesanan" className="text-xs">Pesanan ({orders.length})</TabsTrigger>
        </TabsList>
        <Button size="sm" className="h-9 text-xs" onClick={() => { setForm(blank); setCover(null); setDigital(null); setOpen(true); }}>
          <Plus className="size-3.5" /> Produk Baru
        </Button>
      </div>

      <TabsContent value="produk">
        <ZebraDataTable<ProductRow>
          data={products}
          keyExtractor={(p) => p.id}
          emptyText="Belum ada produk."
          columns={[
            {
              header: 'Produk',
              cell: (p) => (
                <div className="flex items-center gap-3">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt="" className="size-10 rounded-md border border-border/60 object-cover" />
                  ) : (
                    <div className="size-10 rounded-md border border-dashed border-border/80" />
                  )}
                  <div>
                    <div className="font-medium text-foreground">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.product_type === 'digital' ? 'Digital' : 'Fisik'}{p.product_type === 'digital' && !p.file_path ? ' · berkas belum ada' : ''}</div>
                  </div>
                </div>
              ),
            },
            { header: 'Harga', isMono: true, align: 'right', cell: (p) => rupiah(p.price) },
            {
              header: 'Stok',
              isMono: true,
              align: 'right',
              cell: (p) => (p.product_type === 'digital' ? '∞' : p.stock === null ? 'Tak terbatas' : p.stock),
            },
            {
              header: 'Status',
              cell: (p) => <StatusBadge status={p.is_published ? 'Tampil' : 'Disembunyikan'} variant={p.is_published ? 'success' : 'neutral'} size="sm" />,
            },
            {
              header: 'Aksi',
              align: 'right',
              cell: (p) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={`Ubah ${p.title}`} onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" aria-label={`Hapus ${p.title}`} onClick={() => setToDelete(p)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </TabsContent>

      <TabsContent value="pesanan">
        <ZebraDataTable<OrderRow>
          data={orders}
          keyExtractor={(o) => o.id}
          emptyText="Belum ada pesanan."
          columns={[
            {
              header: 'Pesanan',
              cell: (o) => (
                <div className="space-y-0.5">
                  <div className="font-mono text-xs font-semibold">{o.order_number ?? o.id.slice(0, 8)}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDateTime(o.created_at)}</div>
                </div>
              ),
            },
            {
              header: 'Wali · Murid',
              cell: (o) => (
                <div className="text-xs">
                  <div>{o.parents?.profiles?.name ?? '-'}</div>
                  <div className="text-muted-foreground">{o.students?.profiles?.name ?? '-'}</div>
                </div>
              ),
            },
            {
              header: 'Item',
              cell: (o) => (
                <ul className="text-xs space-y-0.5">
                  {o.marketplace_order_items.map((i, idx) => (
                    <li key={idx}>{i.quantity}× {i.marketplace_products?.title ?? '-'}</li>
                  ))}
                </ul>
              ),
            },
            { header: 'Total', isMono: true, align: 'right', cell: (o) => rupiah(o.total_amount) },
            { header: 'Pesanan', cell: (o) => <StatusBadge status={ORDER_LABEL[o.status] ?? o.status} variant={ORDER_VARIANT[o.status] ?? 'neutral'} size="sm" /> },
            {
              header: 'Tagihan',
              cell: (o) => {
                const inv = o.payment_invoices[0];
                return inv ? <StatusBadge status={INVOICE_LABEL[inv.status] ?? inv.status} variant={INVOICE_VARIANT[inv.status] ?? 'neutral'} size="sm" /> : '-';
              },
            },
            {
              header: 'Aksi',
              align: 'right',
              cell: (o) => (
                <div className="flex justify-end gap-1">
                  {o.status === 'pending_payment' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => run(() => cancelOrderAction(o.id))} disabled={isPending}>
                      <XCircle className="size-3.5" /> Batalkan
                    </Button>
                  )}
                  {o.status !== 'fulfilled' && o.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => run(() => markOrderFulfilledAction(o.id))} disabled={isPending}>
                      <PackageCheck className="size-3.5" /> Tandai diambil
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </TabsContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{form.id ? 'Ubah Produk' : 'Produk Baru'}</DialogTitle>
              <DialogDescription className="text-xs">Cover: JPG/PNG/WebP maks. 5 MB. Berkas digital: PDF/EPUB maks. 50 MB.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="p-title" className="text-xs">Nama produk</Label>
              <Input id="p-title" value={form.title} onChange={(e) => update('title', e.target.value)} required minLength={3} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc" className="text-xs">Deskripsi</Label>
              <Textarea id="p-desc" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={5000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-price" className="text-xs">Harga (Rp)</Label>
                <Input id="p-price" type="number" min={1000} step={500} value={form.price} onChange={(e) => update('price', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Jenis</Label>
                <Select value={form.type} onValueChange={(v) => update('type', v as FormState['type'])}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Jenis produk"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical" className="text-xs">Fisik (ambil di sekolah)</SelectItem>
                    <SelectItem value="digital" className="text-xs">Digital (unduh)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === 'physical' ? (
              <div className="space-y-1.5">
                <Label htmlFor="p-stock" className="text-xs">Stok fisik (kosongkan = tak terbatas)</Label>
                <Input id="p-stock" type="number" min={0} value={form.stock} onChange={(e) => update('stock', e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="p-file" className="text-xs">Berkas digital {form.hasFile ? '(kosongkan untuk mempertahankan)' : '(wajib)'}</Label>
                <Input id="p-file" type="file" accept=".pdf,.epub" onChange={(e) => setDigital(e.target.files?.[0] ?? null)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-cover" className="text-xs">Cover (opsional)</Label>
              <Input id="p-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={form.published} onCheckedChange={(v) => update('published', v === true)} />
              Tampilkan di katalog
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan Produk'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Hapus produk?</DialogTitle>
            <DialogDescription className="text-xs">
              &ldquo;{toDelete?.title}&rdquo; dan berkasnya akan dihapus permanen. Produk yang sudah pernah dipesan tidak dapat dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)}>Batal</Button>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={() => toDelete && run(() => deleteProductAction(toDelete.id), () => setToDelete(null))}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
