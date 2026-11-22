'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createScheduleAction, deleteScheduleAction, updateScheduleAction } from '@/actions/lms.actions';
import { DAY_LABELS, formatTime } from '@/lib/date';
import { WeeklySchedule, type ScheduleSlot } from './weekly-schedule';

export interface ClassTeachingOption {
  teacher_id: string;
  subject_id: string;
  subjects: { name: string } | null;
  teachers: { profiles: { name: string } | null } | null;
}

interface Props {
  classrooms: { id: string; name: string }[];
  selectedClassroomId: string;
  semesterId: string;
  slots: ScheduleSlot[];
  options: ClassTeachingOption[];
}

interface FormState {
  id: string | null;
  optionKey: string;
  day: string;
  start: string;
  end: string;
  room: string;
}

const optionKey = (o: { teacher_id: string; subject_id: string }) => `${o.teacher_id}:${o.subject_id}`;

export function ScheduleAdmin({ classrooms, selectedClassroomId, semesterId, slots, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<ScheduleSlot | null>(null);
  const [form, setForm] = React.useState<FormState>({ id: null, optionKey: '', day: '1', start: '07:30', end: '08:40', room: '' });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setForm({ id: null, optionKey: options[0] ? optionKey(options[0]) : '', day: '1', start: '07:30', end: '08:40', room: '' });
    setOpen(true);
  };

  const openEdit = (s: ScheduleSlot) => {
    setForm({
      id: s.id,
      optionKey: optionKey(s),
      day: String(s.day_of_week),
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
      room: s.room ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [teacher_id, subject_id] = form.optionKey.split(':');
    if (!teacher_id || !subject_id) {
      toast.error('Pilih mapel dan guru pengampu.');
      return;
    }
    const payload = {
      classroom_id: selectedClassroomId,
      semester_id: semesterId,
      teacher_id,
      subject_id,
      day_of_week: Number(form.day),
      start_time: form.start,
      end_time: form.end,
      room: form.room,
    };
    startTransition(async () => {
      const res = form.id ? await updateScheduleAction({ ...payload, id: form.id }) : await createScheduleAction(payload);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      const res = await deleteScheduleAction(toDelete.id);
      if (res.success) {
        toast.success(res.message);
        setToDelete(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedClassroomId} onValueChange={(v) => router.push(`${pathname}?kelas=${v}`)}>
          <SelectTrigger className="h-9 w-full sm:w-64 text-xs" aria-label="Pilih rombel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classrooms.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9 text-xs" onClick={openCreate} disabled={options.length === 0}>
          <Plus className="size-3.5" /> Tambah Jadwal
        </Button>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Rombel ini belum memiliki penugasan mengajar pada semester aktif. Tambahkan di menu Penugasan Mengajar terlebih dahulu.
        </p>
      )}

      <WeeklySchedule slots={slots} showTeacher />

      <ZebraDataTable<ScheduleSlot>
        data={slots}
        keyExtractor={(s) => s.id}
        emptyText="Belum ada jadwal pelajaran."
        columns={[
          { header: 'Hari', cell: (s) => DAY_LABELS[s.day_of_week] },
          { header: 'Jam', isMono: true, cell: (s) => `${formatTime(s.start_time)}–${formatTime(s.end_time)}` },
          { header: 'Mapel', cell: (s) => s.subjects?.name ?? '-' },
          { header: 'Guru', cell: (s) => s.teachers?.profiles?.name ?? '-' },
          { header: 'Ruang', cell: (s) => s.room ?? '-' },
          {
            header: 'Aksi',
            align: 'right',
            cell: (s) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Ubah jadwal" onClick={() => openEdit(s)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" aria-label="Hapus jadwal" onClick={() => setToDelete(s)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{form.id ? 'Ubah Jadwal' : 'Tambah Jadwal'}</DialogTitle>
              <DialogDescription className="text-xs">Jadwal hanya Senin–Jumat. Jam yang bentrok dengan kelas atau guru yang sama ditolak.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs">Mapel · Guru</Label>
              <Select value={form.optionKey} onValueChange={(v) => update('optionKey', v)}>
                <SelectTrigger className="h-9 w-full text-xs" aria-label="Mapel dan guru"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={optionKey(o)} value={optionKey(o)} className="text-xs">
                      {o.subjects?.name ?? '-'} · {o.teachers?.profiles?.name ?? '-'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hari</Label>
              <Select value={form.day} onValueChange={(v) => update('day', v)}>
                <SelectTrigger className="h-9 w-full text-xs" aria-label="Hari"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <SelectItem key={d} value={String(d)} className="text-xs">{DAY_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-start" className="text-xs">Mulai</Label>
                <Input id="s-start" type="time" value={form.start} onChange={(e) => update('start', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-end" className="text-xs">Selesai</Label>
                <Input id="s-end" type="time" value={form.end} onChange={(e) => update('end', e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-room" className="text-xs">Ruang (opsional)</Label>
              <Input id="s-room" value={form.room} onChange={(e) => update('room', e.target.value)} maxLength={80} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan Jadwal'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Hapus jadwal?</DialogTitle>
            <DialogDescription className="text-xs">
              {toDelete && `${DAY_LABELS[toDelete.day_of_week]} ${formatTime(toDelete.start_time)}–${formatTime(toDelete.end_time)} · ${toDelete.subjects?.name ?? ''}`}.
              Catatan presensi murid pada jadwal ini ikut terhapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isPending}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
