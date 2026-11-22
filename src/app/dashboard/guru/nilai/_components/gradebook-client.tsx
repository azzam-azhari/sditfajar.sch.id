'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { ZebraDataTable, type ZebraColumn } from '@/components/common/zebra-data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveFinalGradeAction } from '@/actions/lms.actions';
import type { TeachingAssignmentRef } from '@/lib/data/lms';

export interface GradebookRow {
  studentId: string;
  nis: string;
  name: string;
  scores: Record<string, number | null>;
  average: number | null;
  finalScore: number | null;
  finalNote: string | null;
}

interface Props {
  teachingAssignments: TeachingAssignmentRef[];
  selectedId: string;
  scope: { classroom_id: string; subject_id: string; semester_id: string };
  assignments: { id: string; title: string; max_score: number }[];
  rows: GradebookRow[];
}

export function GradebookClient({ teachingAssignments, selectedId, scope, assignments, rows }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.studentId, r.finalScore?.toString() ?? '']))
  );
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const save = (row: GradebookRow) => {
    const value = Number(drafts[row.studentId]);
    if (drafts[row.studentId] === '' || Number.isNaN(value) || value < 0 || value > 100) {
      toast.error('Nilai akhir harus antara 0 dan 100.');
      return;
    }
    setSavingId(row.studentId);
    startTransition(async () => {
      const res = await saveFinalGradeAction({ ...scope, student_id: row.studentId, score: value, description: row.finalNote });
      setSavingId(null);
      if (res.success) {
        toast.success(`${row.name}: ${res.message}`);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const columns: ZebraColumn<GradebookRow>[] = [
    { header: 'NIS', accessorKey: 'nis', isMono: true },
    { header: 'Nama', accessorKey: 'name' },
    ...assignments.map<ZebraColumn<GradebookRow>>((a, index) => ({
      header: `T${index + 1}`,
      isMono: true,
      align: 'right',
      cell: (r) => (r.scores[a.id] === null ? '-' : `${r.scores[a.id]}`),
    })),
    { header: 'Rata-rata', isMono: true, align: 'right', cell: (r) => r.average ?? '-' },
    {
      header: 'Nilai Akhir',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.5"
            aria-label={`Nilai akhir ${r.name}`}
            className="h-7 w-20 text-right font-mono text-xs"
            value={drafts[r.studentId] ?? ''}
            placeholder={r.average?.toString() ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [r.studentId]: e.target.value }))}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            aria-label={`Simpan nilai akhir ${r.name}`}
            disabled={isPending && savingId === r.studentId}
            onClick={() => save(r)}
          >
            <Save className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedId} onValueChange={(v) => router.push(`${pathname}?penugasan=${v}`)}>
          <SelectTrigger className="h-9 w-full sm:w-72 text-xs" aria-label="Pilih kelas dan mapel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teachingAssignments.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                {t.classroom.name} · {t.subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Rata-rata dihitung dari nilai tugas yang sudah dinilai (skala 100). Isi nilai akhir lalu simpan per murid.
        </p>
      </div>

      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {assignments.map((a, i) => (
            <span key={a.id}>
              <span className="font-mono">T{i + 1}</span> {a.title} (maks. {a.max_score})
            </span>
          ))}
        </div>
      )}

      <ZebraDataTable<GradebookRow>
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.studentId}
        emptyText="Nilai belum tersedia."
      />
    </div>
  );
}
