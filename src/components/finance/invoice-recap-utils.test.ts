import { describe, expect, it } from 'vitest';
import { filterInvoices, isOverdue, paginate, summarize, toCsv, type RecapFilters, type RecapInvoice } from './invoice-recap-utils';

const TODAY = '2026-11-22';
const base: RecapFilters = { q: '', status: 'all', type: 'all', classId: 'all', month: '', from: '', to: '' };
const inv = (o: Partial<RecapInvoice>): RecapInvoice => ({
  id: Math.random().toString(36),
  invoice_number: 'INV-202611-00001',
  type: 'spp',
  title: 'SPP November 2026',
  amount: 350000,
  due_date: '2026-11-30',
  status: 'unpaid',
  created_at: '2026-11-01T00:00:00Z',
  studentName: 'Ahmad',
  nis: '990001',
  classroom: { id: 'k1', name: 'Kelas 1' },
  ...o,
});

const rows = [
  inv({ status: 'paid', amount: 350000 }),
  inv({ status: 'unpaid', amount: 350000, due_date: '2026-11-10' }), // overdue
  inv({ status: 'pending', amount: 200000, due_date: '2026-12-05', type: 'lainnya', studentName: 'Siti', nis: '990002' }),
  inv({ status: 'cancelled', amount: 999000 }),
];

describe('isOverdue', () => {
  it('hanya tagihan belum lunas dengan jatuh tempo lewat', () => {
    expect(isOverdue({ status: 'unpaid', due_date: '2026-11-21' }, TODAY)).toBe(true);
    expect(isOverdue({ status: 'unpaid', due_date: TODAY }, TODAY)).toBe(false);
    expect(isOverdue({ status: 'paid', due_date: '2026-01-01' }, TODAY)).toBe(false);
  });
});

describe('summarize', () => {
  it('menjumlah total, lunas, belum dibayar, jatuh tempo; dibatalkan tidak dihitung', () => {
    const s = summarize(rows, TODAY);
    expect(s.total).toEqual({ amount: 900000, count: 3 });
    expect(s.paid).toEqual({ amount: 350000, count: 1 });
    expect(s.outstanding).toEqual({ amount: 550000, count: 2 });
    expect(s.overdue).toEqual({ amount: 350000, count: 1 });
    expect(s.cancelledCount).toBe(1);
  });
});

describe('filterInvoices', () => {
  it('status overdue, jenis, dan pencarian', () => {
    expect(filterInvoices(rows, { ...base, status: 'overdue' }, TODAY)).toHaveLength(1);
    expect(filterInvoices(rows, { ...base, type: 'lainnya' }, TODAY)).toHaveLength(1);
    expect(filterInvoices(rows, { ...base, q: 'siti' }, TODAY)).toHaveLength(1);
  });

  it('bulan jatuh tempo mengalahkan rentang tanggal; rentang inklusif', () => {
    expect(filterInvoices(rows, { ...base, month: '2026-12', from: '2026-01-01', to: '2026-01-31' }, TODAY)).toHaveLength(1);
    expect(filterInvoices(rows, { ...base, from: '2026-11-10', to: '2026-11-30' }, TODAY)).toHaveLength(3);
  });
});

describe('paginate', () => {
  it('menjepit halaman ke rentang valid', () => {
    const r = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(r).toEqual({ items: [5], page: 3, pageCount: 3 });
  });
});

describe('toCsv', () => {
  it('BOM, pemisah titik koma, tanggal DD/MM/YYYY, escape tanda kutip, baris total', () => {
    const csv = toCsv([inv({ title: 'Iuran "Outbound"; Kelas 1', amount: 150000 })], { type: (t) => t, status: (s) => s }, TODAY);
    expect(csv.startsWith('﻿No. Tagihan;Judul')).toBe(true);
    expect(csv).toContain('"Iuran ""Outbound""; Kelas 1"');
    expect(csv).toContain(';150000;30/11/2026;');
    expect(csv.trimEnd().split('\r\n').at(-1)).toContain('TOTAL (tanpa dibatalkan);;;;;150000');
  });
});
