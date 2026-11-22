import { describe, expect, it } from 'vitest';
import { looksLikePhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['0812-3456-7890', '081234567890'],
    ['+62 812 3456 7890', '081234567890'],
    ['6281234567890', '081234567890'],
    ['(021) 765-4321', '0217654321'],
    ['0812.3456.7890', '081234567890'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('tidak mengubah angka pendek berawalan 62 (bukan nomor HP)', () => {
    expect(normalizePhone('6212')).toBe('6212');
  });
});

describe('looksLikePhone', () => {
  it.each(['081234567890', '+62 812 3456 7890', '(021) 765-4321'])('%s dianggap nomor telepon', (v) => {
    expect(looksLikePhone(v)).toBe(true);
  });

  it.each(['990001', 'admin@sditfajar.sch.id', 'ustadz'])('%s bukan nomor telepon', (v) => {
    expect(looksLikePhone(v)).toBe(false);
  });
});
