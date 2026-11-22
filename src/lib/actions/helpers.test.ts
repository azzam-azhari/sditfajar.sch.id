import { describe, expect, it, vi } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import { dbError } from './helpers';

const pgError = (code: string, message = 'db message'): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('dbError', () => {
  it('23505 -> DUPLICATE_ENTRY', () => {
    expect(dbError(pgError('23505'), 'gagal').code).toBe('DUPLICATE_ENTRY');
  });

  it('P0001 meneruskan pesan validasi dari trigger/fungsi', () => {
    const res = dbError(pgError('P0001', 'Nominal transfer harus sama.'), 'gagal');
    expect(res).toMatchObject({ code: 'VALIDATION_ERROR', error: 'Nominal transfer harus sama.' });
  });

  it('42501 -> FORBIDDEN', () => {
    expect(dbError(pgError('42501'), 'gagal').code).toBe('FORBIDDEN');
  });

  it('error lain memakai pesan fallback, bukan pesan database mentah', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = dbError(pgError('XX000', 'detail internal'), 'Gagal menyimpan.');
    expect(res).toMatchObject({ code: 'SERVER_ERROR', error: 'Gagal menyimpan.' });
    spy.mockRestore();
  });
});
