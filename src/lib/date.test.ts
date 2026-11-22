import { describe, expect, it } from 'vitest';
import { jakartaIsoDow, jakartaMonth, jakartaToday, monthRange } from './date';

describe('tanggal Asia/Jakarta (UTC+7)', () => {
  it('pukul 23.30 UTC sudah hari berikutnya di Jakarta', () => {
    const d = new Date('2026-11-21T23:30:00Z'); // 22 Nov 06.30 WIB
    expect(jakartaToday(d)).toBe('2026-11-22');
  });

  it('pukul 16.59 UTC masih hari yang sama di Jakarta', () => {
    const d = new Date('2026-11-22T16:59:00Z'); // 22 Nov 23.59 WIB
    expect(jakartaToday(d)).toBe('2026-11-22');
  });

  it('hari ISO: Minggu = 7, Senin = 1', () => {
    expect(jakartaIsoDow(new Date('2026-11-22T03:00:00Z'))).toBe(7);
    expect(jakartaIsoDow(new Date('2026-11-22T17:30:00Z'))).toBe(1); // Senin 00.30 WIB
  });

  it('bulan berganti mengikuti WIB', () => {
    expect(jakartaMonth(new Date('2026-11-30T18:00:00Z'))).toBe('2026-12');
  });
});

describe('monthRange', () => {
  it('Februari tahun kabisat', () => {
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('November 30 hari', () => {
    expect(monthRange('2026-11')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });
});
