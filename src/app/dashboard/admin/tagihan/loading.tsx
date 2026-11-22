import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton rekap tagihan: header, 4 kartu ringkasan, panel filter, dan baris tabel. */
export default function TagihanLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat rekap tagihan">
      <div className="space-y-2 border-b border-border/80 pb-6">
        <Skeleton className="h-7 w-64 rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
      <span className="sr-only">Memuat data tagihan…</span>
    </div>
  );
}
