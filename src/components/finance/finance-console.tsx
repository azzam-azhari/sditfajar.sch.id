'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Check, FileText, Pencil, Plus, Receipt, X, XCircle } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  approvePaymentProofAction, cancelInvoiceAction, createInvoicesAction, getPaymentProofUrlAction,
  recordCashPaymentAction, rejectPaymentProofAction, updateInvoiceAction,
} from '@/actions/payment.actions';
import { INVOICE_LABEL, INVOICE_VARIANT, rupiah } from '@/components/lms/marketplace-labels';
import { INVOICE_TYPES, INVOICE_TYPE_LABELS } from '@/validations/payment.schema';
import { formatDate, formatDateTime } from '@/lib/date';
import { InvoiceRecap } from './invoice-recap';
import { DatePicker } from "@/components/common/date-picker";

export interface FinanceInvoice {
  id: string;
  invoice_number: string | null;
  type: string;
  title: string;
  amount: number;
  due_date: string | null;
  status: string;
  created_at: string;
  marketplace_order_id: string | null;
  studentName: string;
  nis: string;
  classroom: { id: string; name: string } | null;
  proofs: {
    id: string;
    status: string;
    amount: number;
    transfer_date: string;
    sender_name: string;
    sender_bank: string;
    notes: string | null;
    review_notes: string | null;
    created_at: string;
  }[];
}

type Run = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) => void;

export function FinanceConsole({
  invoices,
  canManageInvoices,
  classrooms,
  students,
  defaultMonth,
  defaultYear,
}: {
  invoices: FinanceInvoice[];
  canManageInvoices: boolean;
  classrooms: { id: string; name: string }[];
  students: { id: string; label: string }[];
  defaultMonth: number;
  defaultYear: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Link rekap berfilter (?status=, ?bulan=, …) langsung membuka tab Tagihan.
  const hasRecapParams = ['q', 'status', 'jenis', 'kelas', 'bulan', 'dari', 'sampai', 'hal'].some((k) => searchParams.has(k));
  const [isPending, startTransition] = React.useTransition();
  const run: Run = (fn, after) =>
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(res.message);
        after?.();
        router.refresh();
      } else toast.error(res.error);
    });

  const [status, setStatus] = React.useState('active');
  const [type, setType] = React.useState('all');
  const [classId, setClassId] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [reviewing, setReviewing] = React.useState<{ invoice: FinanceInvoice; mode: 'approve' | 'reject' } | null>(null);
  const [reviewText, setReviewText] = React.useState('');
  const [cashFor, setCashFor] = React.useState<FinanceInvoice | null>(null);
  const [cashNote, setCashNote] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FinanceInvoice | null>(null);
  const [detail, setDetail] = React.useState<FinanceInvoice | null>(null);
  const [cancelling, setCancelling] = React.useState<FinanceInvoice | null>(null);

  const pendingProofs = invoices.filter((i) => i.status === 'pending' && i.proofs.some((p) => p.status === 'pending'));
  const filtered = invoices.filter((i) => {
    if (status === 'active' && !['unpaid', 'pending'].includes(i.status)) return false;
    if (status !== 'active' && status !== 'all' && i.status !== status) return false;
    if (type !== 'all' && i.type !== type) return false;
    if (classId !== 'all' && i.classroom?.id !== classId) return false;
    const q = search.trim().toLowerCase();
    if (q && ![i.studentName, i.nis, i.invoice_number ?? '', i.title].some((v) => v.toLowerCase().includes(q))) return false;
    return true;
  });

  const openProof = (proofId: string) => {
    const win = window.open('about:blank', '_blank');
    startTransition(async () => {
      const res = await getPaymentProofUrlAction(proofId);
      if (res.success) {
        if (win) win.location.href = res.data.url;
        else window.open(res.data.url, '_blank', 'noopener,noreferrer');
      } else {
        win?.close();
        toast.error(res.error);
      }
    });
  };

  const latestPending = (i: FinanceInvoice) => i.proofs.find((p) => p.status === 'pending');

  const statusBadge = (i: FinanceInvoice) => {
    const label = i.status === 'pending' ? 'Menunggu verifikasi' : INVOICE_LABEL[i.status] ?? i.status;
    return <StatusBadge status={label} variant={INVOICE_VARIANT[i.status] ?? 'neutral'} size="sm" />;
  };

  return (
    <Tabs defaultValue={pendingProofs.length && !hasRecapParams ? 'verifikasi' : 'tagihan'} className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="verifikasi" className="text-xs">Verifikasi Bukti ({pendingProofs.length})</TabsTrigger>
          <TabsTrigger value="tagihan" className="text-xs">Tagihan ({invoices.length})</TabsTrigger>
        </TabsList>
        {canManageInvoices && (
          <Button size="sm" className="h-9 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> Buat Tagihan
          </Button>
        )}
      </div>

      <TabsContent value="verifikasi">
        <ZebraDataTable<FinanceInvoice>
          data={pendingProofs}
          keyExtractor={(i) => i.id}
          emptyText="Tidak ada bukti pembayaran yang menunggu verifikasi."
          columns={[
            {
              header: 'Tagihan',
              cell: (i) => (
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">{i.title}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{i.invoice_number}</div>
                </div>
              ),
            },
            { header: 'Murid', cell: (i) => <span className="text-xs">{i.studentName} · {i.classroom?.name ?? '-'}</span> },
            { header: 'Nominal', isMono: true, align: 'right', cell: (i) => rupiah(i.amount) },
            {
              header: 'Transfer',
              cell: (i) => {
                const p = latestPending(i);
                return p ? (
                  <div className="text-xs">
                    <div>{p.sender_name} · {p.sender_bank}</div>
                    <div className="text-muted-foreground">{formatDate(p.transfer_date)} · kirim {formatDateTime(p.created_at)}</div>
                  </div>
                ) : '-';
              },
            },
            {
              header: 'Aksi',
              align: 'right',
              cell: (i) => {
                const p = latestPending(i);
                if (!p) return '-';
                return (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openProof(p.id)} disabled={isPending}>
                      <FileText className="size-3.5" /> Bukti
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => { setReviewing({ invoice: i, mode: 'approve' }); setReviewText(''); }}>
                      <Check className="size-3.5" /> Setujui
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { setReviewing({ invoice: i, mode: 'reject' }); setReviewText(''); }}>
                      <X className="size-3.5" /> Tolak
                    </Button>
                  </div>
                );
              },
            },
          ]}
        />
      </TabsContent>

      <TabsContent value="tagihan" className="space-y-3">
        {canManageInvoices ? (
          <InvoiceRecap
            invoices={invoices}
            classrooms={classrooms}
            canManage={canManageInvoices}
            actions={{
              onDetail: setDetail,
              onCash: (i) => { setCashFor(i); setCashNote(''); },
              onEdit: setEditing,
              onCancel: setCancelling,
            }}
          />
        ) : (
        <>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="Cari nama, NIS, nomor tagihan…" aria-label="Cari tagihan" className="h-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-full text-xs" aria-label="Filter status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active" className="text-xs">Belum lunas</SelectItem>
              <SelectItem value="paid" className="text-xs">Lunas</SelectItem>
              <SelectItem value="cancelled" className="text-xs">Dibatalkan</SelectItem>
              <SelectItem value="all" className="text-xs">Semua status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-full text-xs" aria-label="Filter jenis"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua jenis</SelectItem>
              {[...INVOICE_TYPES, 'marketplace'].map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{INVOICE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="h-9 w-full text-xs" aria-label="Filter kelas"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ZebraDataTable<FinanceInvoice>
          data={filtered}
          keyExtractor={(i) => i.id}
          emptyText="Tidak ada tagihan sesuai filter."
          columns={[
            {
              header: 'Tagihan',
              cell: (i) => (
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">{i.title}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{i.invoice_number} · {INVOICE_TYPE_LABELS[i.type] ?? i.type}</div>
                </div>
              ),
            },
            {
              header: 'Murid',
              cell: (i) => (
                <div className="text-xs">
                  <div>{i.studentName}</div>
                  <div className="text-muted-foreground font-mono">{i.nis} · {i.classroom?.name ?? '-'}</div>
                </div>
              ),
            },
            { header: 'Nominal', isMono: true, align: 'right', cell: (i) => rupiah(i.amount) },
            { header: 'Jatuh Tempo', isMono: true, cell: (i) => formatDate(i.due_date) },
            { header: 'Status', cell: statusBadge },
            {
              header: 'Aksi',
              align: 'right',
              cell: (i) => (
                <div className="flex justify-end gap-1">
                  {i.status === 'paid' && (
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link href={`/dashboard/kuitansi/${i.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Buka kuitansi ${i.invoice_number ?? ""} di tab baru`}><Receipt className="size-3.5" /> Kuitansi</Link>
                    </Button>
                  )}
                  {(i.status === 'unpaid' || i.status === 'pending') && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCashFor(i); setCashNote(''); }}>
                      <Banknote className="size-3.5" /> Tunai
                    </Button>
                  )}
                  {canManageInvoices && i.status === 'unpaid' && !i.marketplace_order_id && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={`Ubah ${i.title}`} onClick={() => setEditing(i)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" aria-label={`Batalkan ${i.title}`} onClick={() => run(() => cancelInvoiceAction(i.id))} disabled={isPending}>
                        <XCircle className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
        </>
        )}
      </TabsContent>

      {/* Detail tagihan (admin) */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{detail?.title}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{detail?.invoice_number} · {detail && (INVOICE_TYPE_LABELS[detail.type] ?? detail.type)}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-xs">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><dt className="text-muted-foreground">Murid</dt><dd className="text-foreground">{detail.studentName}</dd></div>
                <div><dt className="text-muted-foreground">NIS · Kelas</dt><dd className="font-mono">{detail.nis} · {detail.classroom?.name ?? '-'}</dd></div>
                <div><dt className="text-muted-foreground">Nominal</dt><dd className="font-mono font-semibold">{rupiah(detail.amount)}</dd></div>
                <div><dt className="text-muted-foreground">Jatuh tempo</dt><dd className="font-mono">{formatDate(detail.due_date)}</dd></div>
                <div><dt className="text-muted-foreground">Status</dt><dd>{statusBadge(detail)}</dd></div>
                <div><dt className="text-muted-foreground">Dibuat</dt><dd className="font-mono">{formatDateTime(detail.created_at)}</dd></div>
              </dl>
              <div className="space-y-2">
                <div className="font-semibold text-foreground">Riwayat bukti transfer</div>
                {detail.proofs.length === 0 ? (
                  <p className="text-muted-foreground">Belum ada bukti transfer.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.proofs.map((p) => (
                      <li key={p.id} className="rounded-lg border border-border/80 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>{p.sender_name} · {p.sender_bank} · <span className="font-mono">{rupiah(p.amount)}</span></span>
                          <StatusBadge
                            status={p.status === 'approved' ? 'Disetujui' : p.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                            variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'info'}
                            size="sm"
                          />
                        </div>
                        <div className="mt-1 text-muted-foreground">Transfer {formatDate(p.transfer_date)} · dikirim {formatDateTime(p.created_at)}</div>
                        {p.review_notes && <div className="mt-1 text-muted-foreground">Catatan: {p.review_notes}</div>}
                        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => openProof(p.id)} disabled={isPending}>
                          <FileText className="size-3.5" /> Lihat bukti
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {detail?.status === 'paid' && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/kuitansi/${detail.id}`} target="_blank" rel="noopener noreferrer"><Receipt className="size-3.5" /> Kuitansi</Link>
              </Button>
            )}
            <Button size="sm" onClick={() => setDetail(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi batalkan tagihan */}
      <Dialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Batalkan tagihan?</DialogTitle>
            <DialogDescription className="text-xs">
              {cancelling?.title} · {cancelling?.studentName} · {cancelling && rupiah(cancelling.amount)}. Tagihan yang dibatalkan tidak dapat dibayar lagi dan tidak dihitung dalam rekap.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>Kembali</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => cancelling && run(() => cancelInvoiceAction(cancelling.id), () => setCancelling(null))}
            >
              Ya, batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Setujui / tolak bukti */}
      <Dialog open={!!reviewing} onOpenChange={(v) => !v && setReviewing(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{reviewing?.mode === 'approve' ? 'Setujui pembayaran?' : 'Tolak bukti pembayaran?'}</DialogTitle>
            <DialogDescription className="text-xs">
              {reviewing?.invoice.title} · {reviewing?.invoice.studentName} · {reviewing && rupiah(reviewing.invoice.amount)}
              {reviewing?.mode === 'approve' ? '. Pastikan dana sudah masuk ke rekening sekolah. Tagihan akan lunas dan kuitansi terbit.' : '. Tagihan kembali belum dibayar dan wali dapat mengunggah ulang.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="review-text" className="text-xs">{reviewing?.mode === 'approve' ? 'Catatan (opsional)' : 'Alasan penolakan (wajib)'}</Label>
            <Textarea id="review-text" rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReviewing(null)}>Batal</Button>
            <Button
              size="sm"
              variant={reviewing?.mode === 'approve' ? 'default' : 'destructive'}
              disabled={isPending}
              onClick={() => {
                if (!reviewing) return;
                const proof = latestPending(reviewing.invoice);
                if (!proof) return;
                run(
                  () =>
                    reviewing.mode === 'approve'
                      ? approvePaymentProofAction({ proof_id: proof.id, notes: reviewText })
                      : rejectPaymentProofAction({ proof_id: proof.id, reason: reviewText }),
                  () => setReviewing(null)
                );
              }}
            >
              {reviewing?.mode === 'approve' ? 'Setujui & Lunasi' : 'Tolak Bukti'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catat tunai */}
      <Dialog open={!!cashFor} onOpenChange={(v) => !v && setCashFor(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Catat pembayaran tunai</DialogTitle>
            <DialogDescription className="text-xs">
              {cashFor?.title} · {cashFor?.studentName} · {cashFor && rupiah(cashFor.amount)}. Tagihan dilunasi penuh dan kuitansi terbit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cash-note" className="text-xs">Catatan (opsional)</Label>
            <Textarea id="cash-note" rows={3} value={cashNote} onChange={(e) => setCashNote(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCashFor(null)}>Batal</Button>
            <Button size="sm" disabled={isPending} onClick={() => cashFor && run(() => recordCashPaymentAction({ invoice_id: cashFor.id, notes: cashNote }), () => setCashFor(null))}>
              Catat Lunas Tunai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManageInvoices && (
        <>
          <CreateInvoiceDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            classrooms={classrooms}
            students={students}
            defaultMonth={defaultMonth}
            defaultYear={defaultYear}
            run={run}
            isPending={isPending}
          />
          <EditInvoiceDialog invoice={editing} onClose={() => setEditing(null)} run={run} isPending={isPending} />
        </>
      )}
    </Tabs>
  );
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function CreateInvoiceDialog({
  open, onOpenChange, classrooms, students, defaultMonth, defaultYear, run, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classrooms: { id: string; name: string }[];
  students: { id: string; label: string }[];
  defaultMonth: number;
  defaultYear: number;
  run: Run;
  isPending: boolean;
}) {
  const [target, setTarget] = React.useState<'classroom' | 'student'>('classroom');
  const [classroomId, setClassroomId] = React.useState(classrooms[0]?.id ?? '');
  const [studentId, setStudentId] = React.useState(students[0]?.id ?? '');
  const [type, setType] = React.useState<(typeof INVOICE_TYPES)[number]>('spp');
  const [month, setMonth] = React.useState(String(defaultMonth));
  const [year, setYear] = React.useState(String(defaultYear));
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [due, setDue] = React.useState('');

  const autoTitle = type === 'spp' ? `SPP ${MONTHS[Number(month) - 1]} ${year}` : '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () =>
        createInvoicesAction({
          target,
          classroom_id: target === 'classroom' ? classroomId : null,
          student_id: target === 'student' ? studentId : null,
          type,
          title: title || autoTitle,
          amount: Number(amount),
          due_date: due,
          billing_month: type === 'spp' ? Number(month) : null,
          billing_year: type === 'spp' ? Number(year) : null,
        }),
      () => onOpenChange(false)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm">Buat Tagihan</DialogTitle>
            <DialogDescription className="text-xs">Untuk satu kelas sekaligus atau satu murid. Murid yang sudah punya tagihan sejenis di periode yang sama dilewati.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as 'classroom' | 'student')}>
                <SelectTrigger className="h-9 w-full text-xs" aria-label="Target tagihan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classroom" className="text-xs">Satu kelas</SelectItem>
                  <SelectItem value="student" className="text-xs">Satu murid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{target === 'classroom' ? 'Kelas' : 'Murid'}</Label>
              {target === 'classroom' ? (
                <Select value={classroomId} onValueChange={setClassroomId}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Kelas tagihan"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Murid tagihan"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Jenis</Label>
            <Select value={type} onValueChange={(v) => setType(v as (typeof INVOICE_TYPES)[number])}>
              <SelectTrigger className="h-9 w-full text-xs" aria-label="Jenis tagihan"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{INVOICE_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {type === 'spp' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bulan buku</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Bulan buku"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)} className="text-xs">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-year" className="text-xs">Tahun buku</Label>
                <Input id="inv-year" type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(e.target.value)} required />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="inv-title" className="text-xs">Judul tagihan</Label>
            <Input id="inv-title" placeholder={autoTitle || 'Contoh: Iuran Outbound Kelas 1'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required={type !== 'spp'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-amount" className="text-xs">Nominal (Rp)</Label>
              <Input id="inv-amount" type="number" min={1000} step={500} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due" className="text-xs">Jatuh tempo</Label>
              <DatePicker id="inv-due" value={due} onChange={setDue} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Buat Tagihan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditInvoiceDialog({ invoice, onClose, run, isPending }: { invoice: FinanceInvoice | null; onClose: () => void; run: Run; isPending: boolean }) {
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [due, setDue] = React.useState('');
  const [lastId, setLastId] = React.useState<string | null>(null);
  if (invoice && invoice.id !== lastId) {
    setLastId(invoice.id);
    setTitle(invoice.title);
    setAmount(String(invoice.amount));
    setDue(invoice.due_date ?? '');
  }
  return (
    <Dialog open={!!invoice} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!invoice) return;
            run(() => updateInvoiceAction({ id: invoice.id, title, amount: Number(amount), due_date: due }), onClose);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle className="text-sm">Ubah Tagihan</DialogTitle>
            <DialogDescription className="text-xs">{invoice?.invoice_number} · {invoice?.studentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ed-title" className="text-xs">Judul</Label>
            <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed-amount" className="text-xs">Nominal (Rp)</Label>
              <Input id="ed-amount" type="number" min={1000} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-due" className="text-xs">Jatuh tempo</Label>
              <DatePicker id="ed-due" value={due} onChange={setDue} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
            <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
