import { describe, expect, it } from 'vitest';
import { validateFileServer } from './storage';

const MB = 1024 * 1024;

describe('validateFileServer', () => {
  it('menerima gambar JPG kecil di bucket images', () => {
    expect(validateFileServer('logo.jpg', 'image/jpeg', 200_000, 'images').valid).toBe(true);
  });

  it('menolak berkas tanpa ekstensi', () => {
    expect(validateFileServer('logo', 'image/png', 1000, 'images').valid).toBe(false);
  });

  it('menolak ekstensi berbahaya walau MIME disamarkan', () => {
    expect(validateFileServer('virus.exe', 'image/png', 1000, 'images').valid).toBe(false);
  });

  it('menolak MIME yang tidak sesuai bucket', () => {
    expect(validateFileServer('bukti.pdf', 'application/pdf', 1000, 'images').valid).toBe(false);
  });

  it('menerima PDF bukti transfer dan menolak yang > 5 MB', () => {
    expect(validateFileServer('bukti.pdf', 'application/pdf', 1 * MB, 'payment-files').valid).toBe(true);
    expect(validateFileServer('bukti.pdf', 'application/pdf', 6 * MB, 'payment-files').valid).toBe(false);
  });
});
