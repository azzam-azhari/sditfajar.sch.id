'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Error khusus rekap tagihan: pesan jelas + coba lagi (muat ulang data server). */
export default function TagihanError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    console.error('[Tagihan] Gagal memuat:', error);
  }, [error]);

  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-border/80 bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
        <AlertCircle className="size-6" />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Data tagihan gagal dimuat</h2>
        <p className="text-sm text-muted-foreground">
          Periksa koneksi internet lalu coba lagi. Bila masih gagal, hubungi admin sistem.
          {error.digest && <span className="mt-1 block font-mono text-[11px]">Kode: {error.digest}</span>}
        </p>
      </div>
      <Button onClick={retry} disabled={isPending} className="text-xs">
        <RotateCcw className={isPending ? 'size-3.5 animate-spin' : 'size-3.5'} />
        {isPending ? 'Memuat ulang…' : 'Coba lagi'}
      </Button>
    </div>
  );
}
