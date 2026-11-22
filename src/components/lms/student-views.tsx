import * as React from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import { ZebraDataTable, type ZebraColumn } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { LmsFileButton } from '@/components/lms/lms-file-button';
import { Button } from '@/components/ui/button';
import { ATTENDANCE_LABELS, SUBMISSION_STATUS_LABELS } from '@/lib/data/lms';
import { formatDate, formatDateTime, formatTime } from '@/lib/date';
import type {
  AnnouncementView, AssignmentView, AttendanceView, FinalGradeView, MaterialView, TodaySlot,
} from '@/lib/data/student-overview';

/** Tampilan data akademik murid yang dipakai bersama dashboard murid dan wali murid. */

export function TodayScheduleTable({ slots, emptyText }: { slots: TodaySlot[]; emptyText?: string }) {
  return (
    <ZebraDataTable<TodaySlot>
      data={slots}
      keyExtractor={(s) => s.id}
      emptyText={emptyText ?? 'Tidak ada pelajaran hari ini.'}
      columns={[
        { header: 'Jam', isMono: true, cell: (s) => `${formatTime(s.start_time)}–${formatTime(s.end_time)}` },
        { header: 'Mapel', cell: (s) => s.subjects?.name ?? '-' },
        { header: 'Guru', cell: (s) => s.teachers?.profiles?.name ?? '-' },
        { header: 'Ruang', cell: (s) => s.room ?? '-' },
      ]}
    />
  );
}

export function MaterialTable({ materials }: { materials: MaterialView[] }) {
  return (
    <ZebraDataTable<MaterialView>
      data={materials}
      keyExtractor={(m) => m.id}
      emptyText="Belum ada materi untuk kelas ini."
      columns={[
        {
          header: 'Materi',
          cell: (m) => (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <span className="font-medium text-foreground">{m.title}</span>
                <span className="block text-xs text-muted-foreground">{m.subjects?.name ?? '-'}{m.description ? ` · ${m.description}` : ''}</span>
              </summary>
              {m.content && (
                <div className="mt-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs whitespace-pre-wrap">{m.content}</div>
              )}
            </details>
          ),
        },
        { header: 'Terbit', isMono: true, cell: (m) => formatDate(m.published_at) },
        {
          header: 'Buka',
          align: 'right',
          cell: (m) => (
            <div className="flex justify-end gap-1.5">
              {m.file_path && <LmsFileButton kind="material" id={m.id} label="Berkas" />}
              {m.external_url && (
                <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                  <a href={m.external_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> Tautan
                  </a>
                </Button>
              )}
              {!m.file_path && !m.external_url && <span className="text-xs text-muted-foreground">Klik judul</span>}
            </div>
          ),
        },
      ]}
    />
  );
}

const SUB_VARIANT = { not_submitted: 'neutral', submitted: 'info', late: 'warning', graded: 'success' } as const;

export function submissionState(a: AssignmentView): { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' } {
  if (a.submission && a.submission.status !== 'not_submitted') {
    return { label: SUBMISSION_STATUS_LABELS[a.submission.status], variant: SUB_VARIANT[a.submission.status] };
  }
  const overdue = a.due_at ? new Date(a.due_at).getTime() < Date.now() : false;
  if (a.status === 'closed' || (overdue && !a.allow_late_submission)) return { label: 'Tidak dikumpulkan', variant: 'danger' };
  if (overdue) return { label: 'Lewat batas', variant: 'warning' };
  return { label: 'Belum mengumpulkan', variant: 'neutral' };
}

export function AssignmentTable({
  assignments,
  action,
  emptyText,
}: {
  assignments: AssignmentView[];
  action?: (a: AssignmentView) => React.ReactNode;
  emptyText?: string;
}) {
  const columns: ZebraColumn<AssignmentView>[] = [
    {
      header: 'Tugas',
      cell: (a) => (
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">{a.title}</div>
          <div className="text-xs text-muted-foreground">{a.subjects?.name ?? '-'}</div>
        </div>
      ),
    },
    { header: 'Batas Waktu', isMono: true, cell: (a) => formatDateTime(a.due_at) },
    {
      header: 'Status',
      cell: (a) => {
        const s = submissionState(a);
        return <StatusBadge status={s.label} variant={s.variant} size="sm" />;
      },
    },
    {
      header: 'Nilai',
      isMono: true,
      align: 'right',
      cell: (a) => (a.submission?.score !== null && a.submission?.score !== undefined ? `${a.submission.score}/${a.max_score}` : '-'),
    },
    {
      header: 'Umpan Balik',
      cell: (a) => <span className="text-xs text-muted-foreground line-clamp-2">{a.submission?.feedback ?? '-'}</span>,
    },
  ];
  if (action) columns.push({ header: 'Aksi', align: 'right', cell: action });
  return (
    <ZebraDataTable<AssignmentView>
      data={assignments}
      columns={columns}
      keyExtractor={(a) => a.id}
      emptyText={emptyText ?? 'Belum ada tugas aktif.'}
    />
  );
}

export function FinalGradeTable({ grades }: { grades: FinalGradeView[] }) {
  return (
    <ZebraDataTable<FinalGradeView>
      data={grades}
      keyExtractor={(g) => g.id}
      emptyText="Nilai belum tersedia."
      columns={[
        { header: 'Mapel', cell: (g) => g.subjects?.name ?? '-' },
        { header: 'Semester', cell: (g) => g.semesters?.name ?? '-' },
        { header: 'Nilai Akhir', isMono: true, align: 'right', accessorKey: 'score' },
        { header: 'Catatan', cell: (g) => <span className="text-xs text-muted-foreground">{g.description ?? '-'}</span> },
      ]}
    />
  );
}

const ATT_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  present: 'success',
  late: 'warning',
  excused: 'info',
  sick: 'warning',
  absent: 'danger',
};

export function AttendanceTable({ rows }: { rows: AttendanceView[] }) {
  return (
    <ZebraDataTable<AttendanceView>
      data={rows}
      keyExtractor={(r) => r.id}
      emptyText="Belum ada catatan presensi pada periode ini."
      columns={[
        { header: 'Tanggal', isMono: true, cell: (r) => formatDate(r.attendance_date) },
        { header: 'Jam', isMono: true, cell: (r) => formatTime(r.schedules?.start_time) },
        { header: 'Mapel', cell: (r) => r.schedules?.subjects?.name ?? '-' },
        {
          header: 'Status',
          cell: (r) => <StatusBadge status={ATTENDANCE_LABELS[r.status] ?? r.status} variant={ATT_VARIANT[r.status] ?? 'neutral'} size="sm" />,
        },
        { header: 'Catatan', cell: (r) => <span className="text-xs text-muted-foreground">{r.notes ?? '-'}</span> },
      ]}
    />
  );
}

export function AttendanceSummary({
  summary,
}: {
  summary: { present: number; excused: number; sick: number; absent: number; rate: number | null };
}) {
  const items = [
    { label: 'Hadir', value: summary.present },
    { label: 'Izin', value: summary.excused },
    { label: 'Sakit', value: summary.sick },
    { label: 'Alpa', value: summary.absent },
    { label: '% Hadir', value: summary.rate === null ? '-' : `${summary.rate}%` },
  ];
  return (
    <div className="grid grid-cols-5 gap-2 text-center">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-border/80 px-2 py-2.5">
          <div className="font-mono text-base font-semibold text-foreground">{i.value}</div>
          <div className="text-[11px] text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}

export function AnnouncementList({ items }: { items: AnnouncementView[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Belum ada pengumuman.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="rounded-lg border border-border/80 p-3">
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground">{a.title}</div>
              <div className="text-[11px] font-mono text-muted-foreground">{formatDate(a.published_at ?? a.created_at)}</div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{a.content}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
