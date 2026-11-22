type Variant = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export const ORDER_LABEL: Record<string, string> = {
  draft: 'Draf',
  pending_payment: 'Menunggu bayar',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
  fulfilled: 'Sudah diambil',
};

export const ORDER_VARIANT: Record<string, Variant> = {
  draft: 'neutral',
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'danger',
  fulfilled: 'info',
};

export const INVOICE_LABEL: Record<string, string> = {
  draft: 'Draf',
  unpaid: 'Belum dibayar',
  pending: 'Diproses',
  paid: 'Lunas',
  expired: 'Kedaluwarsa',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
};

export const INVOICE_VARIANT: Record<string, Variant> = {
  draft: 'neutral',
  unpaid: 'warning',
  pending: 'info',
  paid: 'success',
  expired: 'danger',
  failed: 'danger',
  cancelled: 'neutral',
};

export function rupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}
