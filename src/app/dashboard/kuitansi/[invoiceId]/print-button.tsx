'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  return (
    <Button size="sm" className="h-9 text-xs" onClick={() => window.print()}>
      <Printer className="size-3.5" /> Cetak Kuitansi
    </Button>
  );
}
