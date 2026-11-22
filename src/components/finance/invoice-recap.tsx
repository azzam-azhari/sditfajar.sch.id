'use client';

import * as React from 'react';
import Link from 'next/link';
import { debounce, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  AlertTriangle, Banknote, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye,
  FileText, FilterX, MoreHorizontal, Pencil, Receipt, Search, Wallet, XCircle,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { INVOICE_LABEL, INVOICE_VARIANT, rupiah } from '@/components/lms/marketplace-labels';
import { INVOICE_TYPES, INVOICE_TYPE_LABELS } from '@/validations/payment.schema';
import { formatDate, jakartaToday } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { FinanceInvoice } from './finance-console';
import {
  RECAP_STATUSES, RECAP_STATUS_LABELS, filterInvoices, isOverdue, paginate, summarize, toCsv, type RecapFilters,
} from './invoice-recap-utils';
import { DatePicker } from "@/components/common/date-picker";

const PAGE_SIZE = 20;

/** Filter tersimpan di URL (?q=&status=&jenis=&kelas=&bulan=&dari=&sampai=&hal=) agar bisa dibagikan/di-bookmark. */
const recapParams = {
  q: parseAsString.withDefault(''),
  status: parseAsStringLiteral(RECAP_STATUSES).withDefault('all'),
  jenis: parseAsString.withDefault('all'),
  kelas: parseAsString.withDefault('all'),
  bulan: parseAsString.withDefault(''),
  dari: parseAsString.withDefault(''),
  sampai: parseAsString.withDefault(''),
  hal: parseAsInteger.withDefault(1),
};

export interface InvoiceRecapActions {
  onDetail: (i: FinanceInvoice) => void;
  onCash: (i: FinanceInvoice) => void;
  onEdit: (i: FinanceInvoice) => void;
  onCancel: (i: FinanceInvoice) => void;
}

const statusLabel = (status: string) => (status === 'pending' ? 'Menunggu verifikasi' : INVOICE_LABEL[status] ?? status);

function InvoiceStatus({ invoice, today }: { invoice: FinanceInvoice; today: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge status={statusLabel(invoice.status)} variant={INVOICE_VARIANT[invoice.status] ?? 'neutral'} size="sm" />
      {isOverdue(invoice, today) && <StatusBadge status="Lewat tempo" variant="danger" size="sm" />}
    </div>
  );
}

function RowMenu({ invoice, canManage, actions }: { invoice: FinanceInvoice; canManage: boolean; actions: InvoiceRecapActions }) {
  const open = invoice.status === 'unpaid' || invoice.status === 'pending';
  const editable = canManage && invoice.status === 'unpaid' && !invoice.marketplace_order_id;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-8 p-0" aria-label={`Aksi untuk ${invoice.invoice_number ?? invoice.title}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => actions.onDetail(invoice)}>
          <Eye className="size-3.5" /> Detail
        </DropdownMenuItem>
        {invoice.status === 'paid' && (
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/kuitansi/${invoice.id}`} target="_blank" rel="noopener noreferrer">
              <Receipt className="size-3.5" /> Kuitansi (tab baru)
            </Link>
          </DropdownMenuItem>
        )}
        {open && (
          <DropdownMenuItem onSelect={() => actions.onCash(invoice)}>
            <Banknote className="size-3.5" /> Catat tunai
          </DropdownMenuItem>
        )}
        {editable && (
          <>
            <DropdownMenuItem onSelect={() => actions.onEdit(invoice)}>
              <Pencil className="size-3.5" /> Ubah
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onCancel(invoice)}>
              <XCircle className="size-3.5" /> Batalkan tagihan
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SummaryCard({
  label, amount, count, icon: Icon, tone, hint,
}: {
  label: string;
  amount: number;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  hint: string;
}) {
  const toneClass = {
    neutral: 'bg-primary/10 text-primary',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
  }[tone];
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn('flex size-7 items-center justify-center rounded-md', toneClass)} aria-hidden="true">
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="mt-2 font-mono text-lg font-bold tracking-tight text-foreground sm:text-xl">{rupiah(amount)}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {count.toLocaleString('id-ID')} tagihan · {hint}
      </div>
    </div>
  );
}

export function InvoiceRecap({
  invoices,
  classrooms,
  canManage,
  actions,
}: {
  invoices: FinanceInvoice[];
  classrooms: { id: string; name: string }[];
  canManage: boolean;
  actions: InvoiceRecapActions;
}) {
  const [params, setParams] = useQueryStates(recapParams, { history: 'replace' });
  const [today] = React.useState(() => jakartaToday());
  const [searchDraft, setSearchDraft] = React.useState(params.q);

  const { q, status, jenis, kelas, bulan, dari, sampai } = params;
  const filtered = React.useMemo(
    () => filterInvoices(invoices, { q, status, type: jenis, classId: kelas, month: bulan, from: dari, to: sampai }, today),
    [invoices, today, q, status, jenis, kelas, bulan, dari, sampai]
  );
  const summary = React.useMemo(() => summarize(filtered, today), [filtered, today]);
  const { items, page, pageCount } = paginate(filtered, params.hal, PAGE_SIZE);

  const hasFilter = !!(params.q || params.status !== 'all' || params.jenis !== 'all' || params.kelas !== 'all' || params.bulan || params.dari || params.sampai);
  /** Ubah filter dan kembali ke halaman 1. */
  const setFilter = (patch: Partial<typeof params>) => setParams({ ...patch, hal: 1 });
  const resetFilters = () => {
    setSearchDraft('');
    setParams({ q: '', status: 'all', jenis: 'all', kelas: 'all', bulan: '', dari: '', sampai: '', hal: 1 });
  };

  const exportCsv = () => {
    const csv = toCsv(filtered, { type: (t) => INVOICE_TYPE_LABELS[t] ?? t, status: statusLabel }, today);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const period = params.bulan || [params.dari, params.sampai].filter(Boolean).join('_sd_') || 'semua';
    a.href = url;
    a.download = `rekap-tagihan-${period}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = params.bulan
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${params.bulan}-01T00:00:00+07:00`))
    : params.dari || params.sampai
      ? `${params.dari ? formatDate(params.dari) : 'awal'} – ${params.sampai ? formatDate(params.sampai) : 'sekarang'}`
      : 'semua periode';

  return (
    <div className="space-y-4">
      {/* Ringkasan (mengikuti filter) */}
      <section aria-labelledby="recap-summary" className="space-y-2">
        <h2 id="recap-summary" className="sr-only">Ringkasan tagihan sesuai filter</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total tagihan" amount={summary.total.amount} count={summary.total.count} icon={Wallet} tone="neutral" hint={periodLabel} />
          <SummaryCard label="Total lunas" amount={summary.paid.amount} count={summary.paid.count} icon={CheckCircle2} tone="success" hint="sudah diterima" />
          <SummaryCard label="Belum dibayar" amount={summary.outstanding.amount} count={summary.outstanding.count} icon={CalendarClock} tone="warning" hint="termasuk menunggu verifikasi" />
          <SummaryCard label="Lewat jatuh tempo" amount={summary.overdue.amount} count={summary.overdue.count} icon={AlertTriangle} tone="danger" hint="perlu ditagih" />
        </div>
        {summary.cancelledCount > 0 && (
          <p className="text-[11px] text-muted-foreground">{summary.cancelledCount} tagihan dibatalkan tidak dihitung ke total.</p>
        )}
      </section>

      {/* Filter */}
      <section aria-label="Filter tagihan" className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="recap-q" className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="recap-q"
                type="search"
                placeholder="Nama murid, NIS, nomor atau judul tagihan…"
                className="h-9 pl-8 text-xs"
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  setParams({ q: e.target.value, hal: 1 }, { limitUrlUpdates: debounce(300) });
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label id="recap-status-label" className="text-xs">Status</Label>
            <Select value={params.status} onValueChange={(v) => setFilter({ status: v as RecapFilters['status'] })}>
              <SelectTrigger aria-labelledby="recap-status-label" className="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECAP_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{RECAP_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label id="recap-type-label" className="text-xs">Jenis</Label>
            <Select value={params.jenis} onValueChange={(v) => setFilter({ jenis: v })}>
              <SelectTrigger aria-labelledby="recap-type-label" className="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua jenis</SelectItem>
                {[...INVOICE_TYPES, 'marketplace'].map((t) => <SelectItem key={t} value={t} className="text-xs">{INVOICE_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label id="recap-class-label" className="text-xs">Kelas</Label>
            <Select value={params.kelas} onValueChange={(v) => setFilter({ kelas: v })}>
              <SelectTrigger aria-labelledby="recap-class-label" className="h-9 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
                {classrooms.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recap-month" className="text-xs">Bulan jatuh tempo</Label>
            <Input
              id="recap-month"
              type="month"
              className="h-9 text-xs"
              value={params.bulan}
              onChange={(e) => setFilter({ bulan: e.target.value, dari: '', sampai: '' })}
            />
          </div>
          <fieldset className="grid grid-cols-2 gap-2 sm:col-span-2">
            <legend className="sr-only">Rentang tanggal jatuh tempo</legend>
            <div className="space-y-1.5">
              <Label htmlFor="recap-from" className="text-xs">Jatuh tempo dari</Label>
              <DatePicker id="recap-from" className="h-9" value={params.dari} max={params.sampai || undefined} onChange={(v) => setFilter({ dari: v, bulan: '' })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recap-to" className="text-xs">sampai</Label>
              <DatePicker id="recap-to" className="h-9" value={params.sampai} min={params.dari || undefined} onChange={(v) => setFilter({ sampai: v, bulan: '' })} />
            </div>
          </fieldset>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Menampilkan <span className="font-semibold text-foreground">{filtered.length.toLocaleString('id-ID')}</span> dari {invoices.length.toLocaleString('id-ID')} tagihan
          </p>
          <div className="flex gap-2">
            {hasFilter && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={resetFilters}>
                <FilterX className="size-3.5" /> Reset filter
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="size-3.5" /> Export CSV ({filtered.length})
            </Button>
          </div>
        </div>
      </section>

      {/* Data */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
            <FileText className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{invoices.length === 0 ? 'Belum ada tagihan' : 'Tidak ada tagihan sesuai filter'}</p>
            <p className="text-xs text-muted-foreground">
              {invoices.length === 0 ? 'Buat tagihan pertama lewat tombol "Buat Tagihan".' : 'Ubah kata kunci, status, atau periode untuk melihat data lain.'}
            </p>
          </div>
          {hasFilter && (
            <Button variant="outline" size="sm" className="text-xs" onClick={resetFilters}>
              <FilterX className="size-3.5" /> Reset filter
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: tabel dengan header sticky */}
          <div className="hidden max-h-[65vh] overflow-auto rounded-xl border border-border/80 bg-card md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Daftar tagihan sesuai filter, halaman {page} dari {pageCount}</caption>
              <thead className="sticky top-0 z-10 whitespace-nowrap bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-[0_1px_0_var(--border)]">
                <tr>
                  <th scope="col" className="px-4 py-3">Tagihan</th>
                  <th scope="col" className="px-4 py-3">Murid</th>
                  <th scope="col" className="px-4 py-3 text-right">Nominal</th>
                  <th scope="col" className="px-4 py-3">Jatuh Tempo</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0 even:bg-muted/25 hover:bg-muted/40 dark:even:bg-muted/15">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{i.title}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{i.invoice_number} · {INVOICE_TYPE_LABELS[i.type] ?? i.type}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="text-foreground">{i.studentName}</div>
                      <div className="font-mono text-muted-foreground">{i.nis} · {i.classroom?.name ?? '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-mono tabular-nums">{rupiah(i.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs">{formatDate(i.due_date)}</td>
                    <td className="px-4 py-3 align-top"><InvoiceStatus invoice={i} today={today} /></td>
                    <td className="px-2 py-2 text-right align-top"><RowMenu invoice={i} canManage={canManage} actions={actions} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: kartu */}
          <ul role="list" className="space-y-2 md:hidden">
            {items.map((i) => (
              <li key={i.id} className="rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="truncate text-sm font-medium text-foreground">{i.title}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{i.invoice_number}</div>
                  </div>
                  <RowMenu invoice={i} canManage={canManage} actions={actions} />
                </div>
                <div className="mt-2 text-xs text-foreground">{i.studentName} <span className="font-mono text-muted-foreground">· {i.nis} · {i.classroom?.name ?? '-'}</span></div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <InvoiceStatus invoice={i} today={today} />
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums text-foreground">{rupiah(i.amount)}</div>
                    <div className="text-[11px] text-muted-foreground">Jatuh tempo {formatDate(i.due_date)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {pageCount > 1 && (
            <nav aria-label="Halaman daftar tagihan" className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Halaman <span className="font-mono">{page}</span> dari <span className="font-mono">{pageCount}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9 text-xs" disabled={page <= 1} onClick={() => setParams({ hal: page - 1 })}>
                  <ChevronLeft className="size-3.5" /> Sebelumnya
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs" disabled={page >= pageCount} onClick={() => setParams({ hal: page + 1 })}>
                  Berikutnya <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
