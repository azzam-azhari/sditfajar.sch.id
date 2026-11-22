'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Receipt, Upload } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { submitPaymentProofAction } from '@/actions/payment.actions';
import { INVOICE_LABEL, INVOICE_VARIANT, rupiah } from '@/components/lms/marketplace-labels';
import { INVOICE_TYPE_LABELS, type BankAccount } from '@/validations/payment.schema';
import { formatDate, jakartaToday } from '@/lib/date';

export interface ParentInvoice {
  id: string;
  invoice_number: string | null;
  type: string;
  title: string;
  amount: number;
  due_date: string | null;
  status: string;
  studentName: string;
  classroom: string;
  payable: boolean;
  lastProof: { status: string; review_notes: string | null; created_at: string } | null;
}

export function ParentBillingClient({
  invoices,
  bankAccounts,
  instructions,
  paymentOpen,
}: {
  invoices: ParentInvoice[];
  bankAccounts: BankAccount[];
  instructions: string | null;
  paymentOpen: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [paying, setPaying] = React.useState<ParentInvoice | null>(null);
  const [today] = React.useState(() => jakartaToday());
  const [form, setForm] = React.useState({ transfer_date: '', sender_name: '', sender_bank: '', notes: '' });
  const [file, setFile] = React.useState<File | null>(null);

  const active = invoices.filter((i) => i.status === 'unpaid' || i.status === 'pending');
  const history = invoices.filter((i) => !(i.status === 'unpaid' || i.status === 'pending'));

  const openPay = (i: ParentInvoice) => {
    setPaying(i);
    setForm({ transfer_date: today, sender_name: '', sender_bank: '', notes: '' });
    setFile(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    startTransition(async () => {
      const res = await submitPaymentProofAction({ invoice_id: paying.id, amount: paying.amount, ...form }, file);
      if (res.success) {
        toast.success(res.message);
        setPaying(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const statusCell = (i: ParentInvoice) => (
    <div className="space-y-0.5">
      <StatusBadge
        status={i.status === 'pending' ? 'Menunggu verifikasi' : INVOICE_LABEL[i.status] ?? i.status}
        variant={INVOICE_VARIANT[i.status] ?? 'neutral'}
        size="sm"
      />
      {i.status === 'unpaid' && i.lastProof?.status === 'rejected' && (
        <div className="text-[11px] text-rose-600 dark:text-rose-400">Bukti ditolak: {i.lastProof.review_notes}</div>
      )}
    </div>
  );

  const baseColumns = [
    {
      header: 'Tagihan',
      cell: (i: ParentInvoice) => (
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">{i.title}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{i.invoice_number} · {INVOICE_TYPE_LABELS[i.type] ?? i.type}</div>
        </div>
      ),
    },
    { header: 'Anak', cell: (i: ParentInvoice) => <span className="text-xs">{i.studentName} · {i.classroom}</span> },
    { header: 'Nominal', isMono: true, align: 'right' as const, cell: (i: ParentInvoice) => rupiah(i.amount) },
    { header: 'Jatuh Tempo', isMono: true, cell: (i: ParentInvoice) => formatDate(i.due_date) },
    { header: 'Status', cell: statusCell },
  ];

  return (
    <>
      {!paymentOpen && (
        <p className="rounded-lg border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
          Pembayaran daring sedang ditutup sekolah. Silakan bayar tunai di bagian keuangan sekolah.
        </p>
      )}
      <Tabs defaultValue="aktif" className="space-y-4">
        <TabsList>
          <TabsTrigger value="aktif" className="text-xs">Tagihan Aktif ({active.length})</TabsTrigger>
          <TabsTrigger value="riwayat" className="text-xs">Riwayat ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="aktif">
          <ZebraDataTable<ParentInvoice>
            data={active}
            keyExtractor={(i) => i.id}
            emptyText="Tidak ada tagihan aktif. Terima kasih!"
            columns={[
              ...baseColumns,
              {
                header: 'Aksi',
                align: 'right',
                cell: (i) =>
                  i.status === 'unpaid' && i.payable ? (
                    <Button size="sm" className="h-7 text-xs" onClick={() => openPay(i)}>
                      <Upload className="size-3.5" /> Bayar / Unggah Bukti
                    </Button>
                  ) : i.status === 'pending' ? (
                    <span className="text-xs text-muted-foreground">Sedang diverifikasi</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Bayar tunai di sekolah</span>
                  ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="riwayat">
          <ZebraDataTable<ParentInvoice>
            data={history}
            keyExtractor={(i) => i.id}
            emptyText="Belum ada riwayat pembayaran."
            columns={[
              ...baseColumns,
              {
                header: 'Kuitansi',
                align: 'right',
                cell: (i) =>
                  i.status === 'paid' ? (
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link href={`/dashboard/kuitansi/${i.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Buka kuitansi ${i.invoice_number ?? ""} di tab baru`}><Receipt className="size-3.5" /> Kuitansi</Link>
                    </Button>
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">Bayar: {paying?.title}</DialogTitle>
              <DialogDescription className="text-xs">
                {paying?.studentName} · {paying?.invoice_number}. Transfer tepat sebesar{' '}
                <span className="font-mono font-semibold text-foreground">{paying && rupiah(paying.amount)}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="text-xs font-semibold">Rekening tujuan</div>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Rekening belum diatur sekolah. Hubungi bagian keuangan.</p>
              ) : (
                <ul className="space-y-1.5">
                  {bankAccounts.map((b, idx) => (
                    <li key={idx} className="rounded-lg border border-border/80 p-2.5 text-xs">
                      <span className="font-semibold">{b.bank}</span> · <span className="font-mono">{b.account_number}</span> · a.n. {b.account_name}
                    </li>
                  ))}
                </ul>
              )}
              {instructions && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{instructions}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-date" className="text-xs">Tanggal transfer</Label>
                <Input id="pf-date" type="date" max={today} value={form.transfer_date} onChange={(e) => setForm((f) => ({ ...f, transfer_date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-bank" className="text-xs">Bank pengirim</Label>
                <Input id="pf-bank" placeholder="BSI, BCA, …" value={form.sender_bank} onChange={(e) => setForm((f) => ({ ...f, sender_bank: e.target.value }))} required minLength={2} maxLength={80} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-name" className="text-xs">Nama pemilik rekening pengirim</Label>
              <Input id="pf-name" value={form.sender_name} onChange={(e) => setForm((f) => ({ ...f, sender_name: e.target.value }))} required minLength={3} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-file" className="text-xs">Bukti transfer (JPG/PNG/WebP/PDF, maks. 5 MB)</Label>
              <Input id="pf-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-notes" className="text-xs">Catatan (opsional)</Label>
              <Textarea id="pf-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={500} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setPaying(null)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending || bankAccounts.length === 0}>
                <Upload className="size-3.5" /> {isPending ? 'Mengirim…' : 'Kirim Bukti'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
