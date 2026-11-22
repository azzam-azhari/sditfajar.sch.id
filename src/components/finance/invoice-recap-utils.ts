/**
 * Logika murni rekap tagihan (tanpa React) agar bisa diuji unit:
 * filter, ringkasan, pagination, dan ekspor CSV.
 */

export interface RecapInvoice {
  id: string;
  invoice_number: string | null;
  type: string;
  title: string;
  amount: number;
  due_date: string | null;
  status: string;
  created_at: string;
  studentName: string;
  nis: string;
  classroom: { id: string; name: string } | null;
}

/** Status filter: status tagihan apa adanya + "overdue" (belum lunas & lewat jatuh tempo). */
export const RECAP_STATUSES = ['all', 'unpaid', 'pending', 'paid', 'overdue', 'cancelled'] as const;
export type RecapStatus = (typeof RECAP_STATUSES)[number];

export const RECAP_STATUS_LABELS: Record<RecapStatus, string> = {
  all: 'Semua status',
  unpaid: 'Belum dibayar',
  pending: 'Menunggu verifikasi',
  paid: 'Lunas',
  overdue: 'Lewat jatuh tempo',
  cancelled: 'Dibatalkan',
};

export interface RecapFilters {
  q: string;
  status: RecapStatus;
  type: string; // 'all' | jenis tagihan
  classId: string; // 'all' | id kelas
  /** Bulan jatuh tempo YYYY-MM; bila diisi mengabaikan rentang tanggal. */
  month: string;
  /** Rentang jatuh tempo YYYY-MM-DD (inklusif); kosong = tanpa batas. */
  from: string;
  to: string;
}

const OPEN_STATUSES = new Set(['unpaid', 'pending']);

/** Belum lunas dan tanggal jatuh tempo sudah lewat (today = YYYY-MM-DD zona sekolah). */
export function isOverdue(inv: Pick<RecapInvoice, 'status' | 'due_date'>, today: string): boolean {
  return OPEN_STATUSES.has(inv.status) && !!inv.due_date && inv.due_date < today;
}

function inPeriod(due: string | null, f: Pick<RecapFilters, 'month' | 'from' | 'to'>): boolean {
  if (f.month) return !!due && due.slice(0, 7) === f.month;
  if (!f.from && !f.to) return true;
  if (!due) return false;
  if (f.from && due < f.from) return false;
  if (f.to && due > f.to) return false;
  return true;
}

export function filterInvoices<T extends RecapInvoice>(rows: T[], f: RecapFilters, today: string): T[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((i) => {
    if (f.status === 'overdue') {
      if (!isOverdue(i, today)) return false;
    } else if (f.status !== 'all' && i.status !== f.status) return false;
    if (f.type !== 'all' && i.type !== f.type) return false;
    if (f.classId !== 'all' && i.classroom?.id !== f.classId) return false;
    if (!inPeriod(i.due_date, f)) return false;
    if (q && ![i.studentName, i.nis, i.invoice_number ?? '', i.title].some((v) => v.toLowerCase().includes(q))) return false;
    return true;
  });
}

export interface RecapSummary {
  total: { amount: number; count: number };
  paid: { amount: number; count: number };
  outstanding: { amount: number; count: number };
  overdue: { amount: number; count: number };
  cancelledCount: number;
}

/** Ringkasan dari baris hasil filter. Tagihan dibatalkan tidak dihitung ke total. */
export function summarize(rows: RecapInvoice[], today: string): RecapSummary {
  const s: RecapSummary = {
    total: { amount: 0, count: 0 },
    paid: { amount: 0, count: 0 },
    outstanding: { amount: 0, count: 0 },
    overdue: { amount: 0, count: 0 },
    cancelledCount: 0,
  };
  for (const i of rows) {
    if (i.status === 'cancelled') {
      s.cancelledCount++;
      continue;
    }
    s.total.amount += i.amount;
    s.total.count++;
    if (i.status === 'paid') {
      s.paid.amount += i.amount;
      s.paid.count++;
    } else if (OPEN_STATUSES.has(i.status)) {
      s.outstanding.amount += i.amount;
      s.outstanding.count++;
      if (isOverdue(i, today)) {
        s.overdue.amount += i.amount;
        s.overdue.count++;
      }
    }
  }
  return s;
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(Math.max(1, page), pageCount);
  return { items: rows.slice((safe - 1) * pageSize, safe * pageSize), page: safe, pageCount };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** YYYY-MM-DD -> DD/MM/YYYY (dikenali Excel lokal Indonesia sebagai tanggal). */
const idDate = (v: string | null) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '');

/**
 * CSV untuk Excel (lokal Indonesia): pemisah ';', BOM UTF-8, nominal angka murni agar bisa dijumlah.
 * Baris terakhir berisi total tagihan aktif (tanpa yang dibatalkan).
 */
export function toCsv(
  rows: RecapInvoice[],
  labels: { type: (t: string) => string; status: (s: string) => string },
  today: string
): string {
  const header = ['No. Tagihan', 'Judul', 'Jenis', 'Nama Murid', 'NIS', 'Kelas', 'Nominal (Rp)', 'Jatuh Tempo', 'Status', 'Lewat Jatuh Tempo'];
  const lines = rows.map((i) =>
    [
      i.invoice_number ?? '',
      i.title,
      labels.type(i.type),
      i.studentName,
      i.nis,
      i.classroom?.name ?? '',
      Math.round(i.amount),
      idDate(i.due_date),
      labels.status(i.status),
      isOverdue(i, today) ? 'Ya' : 'Tidak',
    ]
      .map(csvCell)
      .join(';')
  );
  const sum = summarize(rows, today);
  lines.push(['', 'TOTAL (tanpa dibatalkan)', '', '', '', '', Math.round(sum.total.amount), '', '', ''].map(csvCell).join(';'));
  return `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`;
}
