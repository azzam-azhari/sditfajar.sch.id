'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { recordStudentAttendanceAction } from '@/actions/lms.actions';
import { cn } from '@/lib/utils';

export interface SessionItem {
  id: string;
  classroomId: string;
  label: string;
  isHomeroomOnly: boolean;
}

type Status = 'present' | 'excused' | 'sick' | 'absent';

export interface RosterItem {
  studentId: string;
  nis: string;
  name: string;
  status: Status | null;
  notes: string;
}

export interface RecapRow {
  studentId: string;
  nis: string;
  name: string;
  present: number;
  excused: number;
  sick: number;
  absent: number;
  rate: number | null;
}

const OPTIONS: { value: Status; label: string; short: string; tone: string }[] = [
  { value: 'present', label: 'Hadir', short: 'H', tone: 'data-[on=true]:bg-emerald-600 data-[on=true]:text-white' },
  { value: 'excused', label: 'Izin', short: 'I', tone: 'data-[on=true]:bg-blue-600 data-[on=true]:text-white' },
  { value: 'sick', label: 'Sakit', short: 'S', tone: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white' },
  { value: 'absent', label: 'Alpa', short: 'A', tone: 'data-[on=true]:bg-rose-600 data-[on=true]:text-white' },
];

interface Props {
  isWeekend: boolean;
  sessions: SessionItem[];
  selectedSessionId: string | null;
  roster: RosterItem[];
  recapClasses: { id: string; name: string }[];
  recapClassId: string | null;
  month: string;
  recap: RecapRow[];
  initialTab: 'hari-ini' | 'rekap';
}

export function StudentAttendanceClient(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [entries, setEntries] = React.useState<Record<string, { status: Status; notes: string }>>(() =>
    Object.fromEntries(props.roster.map((r) => [r.studentId, { status: r.status ?? 'present', notes: r.notes }]))
  );
  const alreadyRecorded = props.roster.some((r) => r.status !== null);
  const session = props.sessions.find((s) => s.id === props.selectedSessionId) ?? null;

  const setParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  };

  const setAll = (status: Status) =>
    setEntries((e) => Object.fromEntries(Object.entries(e).map(([id, v]) => [id, { ...v, status }])));

  const save = () => {
    if (!session) return;
    startTransition(async () => {
      const res = await recordStudentAttendanceAction({
        schedule_id: session.id,
        classroom_id: session.classroomId,
        records: props.roster.map((r) => ({ student_id: r.studentId, status: entries[r.studentId].status, notes: entries[r.studentId].notes })),
      });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const counts = OPTIONS.map((o) => ({ ...o, total: Object.values(entries).filter((e) => e.status === o.value).length }));

  return (
    <Tabs defaultValue={props.initialTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="hari-ini" className="text-xs">Presensi Hari Ini</TabsTrigger>
        <TabsTrigger value="rekap" className="text-xs">Rekap Bulanan</TabsTrigger>
      </TabsList>

      <TabsContent value="hari-ini" className="space-y-4">
        {props.isWeekend ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card p-6 text-sm text-muted-foreground">
            Presensi murid hanya dapat dicatat Senin sampai Jumat.
          </div>
        ) : props.sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-card p-6 text-sm text-muted-foreground">
            Tidak ada sesi jadwal Anda atau kelas binaan Anda hari ini.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Select value={props.selectedSessionId ?? undefined} onValueChange={(v) => setParam({ sesi: v, tab: 'hari-ini' })}>
                <SelectTrigger className="h-9 w-full sm:w-96 text-xs" aria-label="Pilih sesi"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {props.sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.label}{s.isHomeroomOnly ? ' (kelas binaan)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {counts.map((c) => (
                  <span key={c.value} className="font-mono">{c.short}:{c.total}</span>
                ))}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAll('present')}>Semua hadir</Button>
              </div>
            </div>
            {alreadyRecorded && (
              <p className="text-xs text-muted-foreground">Presensi sesi ini sudah tercatat. Perubahan akan memperbarui catatan hari ini.</p>
            )}
            <ZebraDataTable<RosterItem>
              data={props.roster}
              keyExtractor={(r) => r.studentId}
              emptyText="Belum ada murid aktif di kelas ini."
              columns={[
                { header: 'NIS', accessorKey: 'nis', isMono: true },
                { header: 'Nama', accessorKey: 'name' },
                {
                  header: 'Kehadiran',
                  cell: (r) => (
                    <div className="flex gap-1" role="radiogroup" aria-label={`Kehadiran ${r.name}`}>
                      {OPTIONS.map((o) => {
                        const on = entries[r.studentId]?.status === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            title={o.label}
                            data-on={on}
                            onClick={() => setEntries((e) => ({ ...e, [r.studentId]: { ...e[r.studentId], status: o.value } }))}
                            className={cn('h-7 min-w-14 rounded-md border border-border/80 px-2 text-[11px] font-medium transition-colors hover:border-foreground/20', o.tone)}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  ),
                },
                {
                  header: 'Catatan',
                  cell: (r) => (
                    <Input
                      className="h-7 text-xs"
                      aria-label={`Catatan ${r.name}`}
                      value={entries[r.studentId]?.notes ?? ''}
                      maxLength={500}
                      onChange={(e) => setEntries((x) => ({ ...x, [r.studentId]: { ...x[r.studentId], notes: e.target.value } }))}
                    />
                  ),
                },
              ]}
            />
            <div className="flex justify-end">
              <Button size="sm" className="h-9 text-xs" disabled={isPending || props.roster.length === 0} onClick={save}>
                <Save className="size-3.5" /> {isPending ? 'Menyimpan…' : alreadyRecorded ? 'Perbarui Presensi' : 'Simpan Presensi'}
              </Button>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="rekap" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={props.recapClassId ?? undefined} onValueChange={(v) => setParam({ kelas: v, tab: 'rekap' })}>
            <SelectTrigger className="h-9 w-full sm:w-56 text-xs" aria-label="Pilih kelas"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
            <SelectContent>
              {props.recapClasses.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            className="h-9 w-full sm:w-44 text-xs"
            aria-label="Pilih bulan"
            value={props.month}
            onChange={(e) => e.target.value && setParam({ bulan: e.target.value, tab: 'rekap' })}
          />
        </div>
        <ZebraDataTable<RecapRow>
          data={props.recap}
          keyExtractor={(r) => r.studentId}
          emptyText="Belum ada data presensi untuk kelas dan bulan ini."
          columns={[
            { header: 'NIS', accessorKey: 'nis', isMono: true },
            { header: 'Nama', accessorKey: 'name' },
            { header: 'Hadir', accessorKey: 'present', isMono: true, align: 'right' },
            { header: 'Izin', accessorKey: 'excused', isMono: true, align: 'right' },
            { header: 'Sakit', accessorKey: 'sick', isMono: true, align: 'right' },
            { header: 'Alpa', accessorKey: 'absent', isMono: true, align: 'right' },
            { header: '% Hadir', isMono: true, align: 'right', cell: (r) => (r.rate === null ? '-' : `${r.rate}%`) },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}
