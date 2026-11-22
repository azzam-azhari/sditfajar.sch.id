'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createTahfidzRecordAction, deleteTahfidzRecordAction, updateTahfidzRecordAction,
} from '@/actions/tahfidz.actions';
import { PREDICATE_LABELS, SURAHS, TAHFIDZ_PREDICATES, getSurah, type TahfidzPredicate } from '@/constants/quran';
import { formatDate } from '@/lib/date';

export interface StudentOption {
  id: string;
  label: string;
  name: string;
  nis: string;
  classroom: string;
}

export interface RecordItem {
  id: string;
  teacher_id: string;
  surah_number: number;
  ayat_start: number;
  ayat_end: number;
  pages: number | null;
  predicate: TahfidzPredicate;
  record_date: string;
  notes: string | null;
  profiles: { name: string } | null;
}

export interface RecapRow {
  studentId: string;
  nis: string;
  name: string;
  classroom: string;
  records: number;
  ayat: number;
  pages: number;
  highestJuz: number | null;
  lastDate: string | null;
  lastSurah: string | null;
  lastPredicate: TahfidzPredicate | null;
}

const PREDICATE_VARIANT = { mumtaz: 'success', jayyid_jiddan: 'info', jayyid: 'neutral', maqbul: 'warning' } as const;

interface FormState {
  id: string | null;
  surah: string;
  ayatStart: string;
  ayatEnd: string;
  pages: string;
  predicate: TahfidzPredicate;
  date: string;
  notes: string;
}

export function TahfidzClient({
  currentUserId,
  students,
  selectedStudentId,
  records,
  today,
  isCoordinator,
  recap,
  initialTab,
}: {
  currentUserId: string;
  students: StudentOption[];
  selectedStudentId: string;
  records: RecordItem[];
  today: string;
  isCoordinator: boolean;
  recap: RecapRow[];
  initialTab: 'setoran' | 'rekap';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<RecordItem | null>(null);
  const blank: FormState = { id: null, surah: '78', ayatStart: '1', ayatEnd: '', pages: '', predicate: 'jayyid', date: today, notes: '' };
  const [form, setForm] = React.useState<FormState>(blank);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const surahInfo = getSurah(Number(form.surah));

  const goStudent = (id: string, tab = 'setoran') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('murid', id);
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  const openEdit = (r: RecordItem) => {
    setForm({
      id: r.id, surah: String(r.surah_number), ayatStart: String(r.ayat_start), ayatEnd: String(r.ayat_end),
      pages: r.pages?.toString() ?? '', predicate: r.predicate, date: r.record_date, notes: r.notes ?? '',
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      student_id: selectedStudentId,
      surah_number: Number(form.surah),
      ayat_start: Number(form.ayatStart),
      ayat_end: Number(form.ayatEnd),
      pages: form.pages === '' ? null : Number(form.pages),
      predicate: form.predicate,
      record_date: form.date,
      notes: form.notes,
    };
    startTransition(async () => {
      const res = form.id ? await updateTahfidzRecordAction({ ...payload, id: form.id }) : await createTahfidzRecordAction(payload);
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
      const res = await deleteTahfidzRecordAction(toDelete.id);
      if (res.success) {
        toast.success(res.message);
        setToDelete(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const setoran = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={selectedStudentId} onValueChange={(v) => goStudent(v)}>
          <SelectTrigger className="h-9 w-full sm:w-80 text-xs" aria-label="Pilih murid"><SelectValue /></SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9 text-xs" onClick={() => { setForm(blank); setOpen(true); }}>
          <Plus className="size-3.5" /> Catat Setoran
        </Button>
      </div>
      <ZebraDataTable<RecordItem>
        data={records}
        keyExtractor={(r) => r.id}
        emptyText="Belum ada setoran hafalan."
        columns={[
          { header: 'Tanggal', isMono: true, cell: (r) => formatDate(r.record_date) },
          { header: 'Surah', cell: (r) => `${r.surah_number}. ${getSurah(r.surah_number)?.name ?? '-'}` },
          { header: 'Ayat', isMono: true, cell: (r) => `${r.ayat_start}–${r.ayat_end}` },
          { header: 'Halaman', isMono: true, align: 'right', cell: (r) => r.pages ?? '-' },
          { header: 'Predikat', cell: (r) => <StatusBadge status={PREDICATE_LABELS[r.predicate]} variant={PREDICATE_VARIANT[r.predicate]} size="sm" /> },
          { header: 'Penyimak', cell: (r) => <span className="text-xs">{r.profiles?.name ?? '-'}</span> },
          {
            header: 'Aksi',
            align: 'right',
            cell: (r) =>
              r.teacher_id === currentUserId ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Ubah setoran" onClick={() => openEdit(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" aria-label="Hapus setoran" onClick={() => setToDelete(r)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
        ]}
      />
    </div>
  );

  return (
    <>
      {isCoordinator ? (
        <Tabs defaultValue={initialTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="setoran" className="text-xs">Setoran Murid</TabsTrigger>
            <TabsTrigger value="rekap" className="text-xs">Rekap Koordinator</TabsTrigger>
          </TabsList>
          <TabsContent value="setoran">{setoran}</TabsContent>
          <TabsContent value="rekap">
            <ZebraDataTable<RecapRow>
              data={recap}
              keyExtractor={(r) => r.studentId}
              emptyText="Belum ada data murid."
              columns={[
                { header: 'NIS', accessorKey: 'nis', isMono: true },
                {
                  header: 'Nama',
                  cell: (r) => (
                    <button type="button" className="text-left hover:underline" onClick={() => goStudent(r.studentId)}>
                      {r.name}
                    </button>
                  ),
                },
                { header: 'Kelas', accessorKey: 'classroom' },
                { header: 'Setoran', accessorKey: 'records', isMono: true, align: 'right' },
                { header: 'Ayat', accessorKey: 'ayat', isMono: true, align: 'right' },
                { header: 'Halaman', accessorKey: 'pages', isMono: true, align: 'right' },
                { header: 'Juz Tertinggi', isMono: true, align: 'right', cell: (r) => r.highestJuz ?? '-' },
                { header: 'Terakhir', cell: (r) => <span className="text-xs">{r.lastDate ? `${formatDate(r.lastDate)} · ${r.lastSurah}` : '-'}</span> },
                {
                  header: 'Predikat',
                  cell: (r) => (r.lastPredicate ? <StatusBadge status={PREDICATE_LABELS[r.lastPredicate]} variant={PREDICATE_VARIANT[r.lastPredicate]} size="sm" /> : '-'),
                },
              ]}
            />
          </TabsContent>
        </Tabs>
      ) : (
        setoran
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{form.id ? 'Ubah Setoran' : 'Catat Setoran Hafalan'}</DialogTitle>
              <DialogDescription className="text-xs">{students.find((s) => s.id === selectedStudentId)?.label}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs">Surah</Label>
              <Select value={form.surah} onValueChange={(v) => update('surah', v)}>
                <SelectTrigger className="h-9 w-full text-xs" aria-label="Surah"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {SURAHS.map((s) => (
                    <SelectItem key={s.number} value={String(s.number)} className="text-xs">
                      {s.number}. {s.name} ({s.ayat} ayat · juz {s.juz})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tf-start" className="text-xs">Ayat mulai</Label>
                <Input id="tf-start" type="number" min={1} max={surahInfo?.ayat} value={form.ayatStart} onChange={(e) => update('ayatStart', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tf-end" className="text-xs">Ayat selesai</Label>
                <Input id="tf-end" type="number" min={1} max={surahInfo?.ayat} value={form.ayatEnd} onChange={(e) => update('ayatEnd', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tf-pages" className="text-xs">Jumlah halaman</Label>
                <Input id="tf-pages" type="number" min={0} step="0.5" value={form.pages} onChange={(e) => update('pages', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Predikat kelancaran</Label>
                <Select value={form.predicate} onValueChange={(v) => update('predicate', v as TahfidzPredicate)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Predikat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAHFIDZ_PREDICATES.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">{PREDICATE_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tf-date" className="text-xs">Tanggal setoran</Label>
                <Input id="tf-date" type="date" max={today} value={form.date} onChange={(e) => update('date', e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tf-notes" className="text-xs">Catatan (opsional)</Label>
              <Textarea id="tf-notes" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} maxLength={1000} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan Setoran'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Hapus setoran?</DialogTitle>
            <DialogDescription className="text-xs">Catatan setoran ini akan dihapus permanen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={isPending}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
