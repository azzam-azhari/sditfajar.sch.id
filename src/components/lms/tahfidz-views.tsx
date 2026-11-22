import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { getSurah, PREDICATE_LABELS } from '@/constants/quran';
import { formatDate } from '@/lib/date';
import type { TahfidzRecordView, TahfidzSummary } from '@/lib/data/tahfidz';

const PREDICATE_VARIANT = { mumtaz: 'success', jayyid_jiddan: 'info', jayyid: 'neutral', maqbul: 'warning' } as const;

export function surahLabel(number: number): string {
  const s = getSurah(number);
  return s ? `${s.number}. ${s.name}` : `Surah ${number}`;
}

export function PredicateBadge({ value }: { value: TahfidzRecordView['predicate'] }) {
  return <StatusBadge status={PREDICATE_LABELS[value]} variant={PREDICATE_VARIANT[value]} size="sm" />;
}

/** Ringkasan progres hafalan (dipakai murid, wali, dan guru). */
export function TahfidzSummaryCards({ summary }: { summary: TahfidzSummary }) {
  const items = [
    { label: 'Setoran', value: summary.totalRecords },
    { label: 'Ayat', value: summary.totalAyat },
    { label: 'Halaman', value: summary.totalPages },
    { label: 'Surah', value: summary.surahCount },
    { label: 'Juz tertinggi', value: summary.highestJuz ?? '-' },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2 text-center">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg border border-border/80 px-2 py-2.5">
            <div className="font-mono text-base font-semibold text-foreground">{i.value}</div>
            <div className="text-[11px] text-muted-foreground">{i.label}</div>
          </div>
        ))}
      </div>
      {summary.last && (
        <p className="text-xs text-muted-foreground">
          Setoran terakhir {formatDate(summary.last.record_date)}: {surahLabel(summary.last.surah_number)} ayat{' '}
          {summary.last.ayat_start}–{summary.last.ayat_end} (juz {getSurah(summary.last.surah_number)?.juz ?? '-'}).
        </p>
      )}
    </div>
  );
}

export function TahfidzHistoryTable({ records }: { records: TahfidzRecordView[] }) {
  return (
    <ZebraDataTable<TahfidzRecordView>
      data={records}
      keyExtractor={(r) => r.id}
      emptyText="Belum ada setoran hafalan."
      columns={[
        { header: 'Tanggal', isMono: true, cell: (r) => formatDate(r.record_date) },
        { header: 'Surah', cell: (r) => surahLabel(r.surah_number) },
        { header: 'Ayat', isMono: true, cell: (r) => `${r.ayat_start}–${r.ayat_end}` },
        { header: 'Halaman', isMono: true, align: 'right', cell: (r) => r.pages ?? '-' },
        { header: 'Predikat', cell: (r) => <PredicateBadge value={r.predicate} /> },
        { header: 'Penyimak', cell: (r) => <span className="text-xs">{r.profiles?.name ?? '-'}</span> },
        { header: 'Catatan', cell: (r) => <span className="text-xs text-muted-foreground">{r.notes ?? '-'}</span> },
      ]}
    />
  );
}
