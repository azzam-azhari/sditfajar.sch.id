'use client';

import { ExternalLink, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  return (
    <Button size="sm" className="h-9 text-xs" onClick={() => window.print()}>
      <Printer className="size-3.5" /> Cetak Kuitansi
    </Button>
  );
}

/** Membuka kuitansi yang sama di tab baru (mis. saat dibuka dari route lama atau ingin dicetak terpisah). */
export function OpenInNewTabButton() {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-9 text-xs"
      onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
    >
      <ExternalLink className="size-3.5" /> Buka di Tab Baru
    </Button>
  );
}
