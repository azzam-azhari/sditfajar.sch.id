'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { StatusBadge } from '@/components/common/status-badge';
import { LmsFileButton } from '@/components/lms/lms-file-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  closeAssignmentAction, createAssignmentAction, deleteAssignmentAction, gradeSubmissionAction, updateAssignmentAction,
} from '@/actions/lms.actions';
import type { TeachingAssignmentRef } from '@/lib/data/lms';
import { formatDateTime } from '@/lib/date';

export interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  instructions: string | null;
  file_path: string | null;
  status: 'draft' | 'published' | 'closed';
  due_at: string | null;
  allow_late_submission: boolean;
  late_tolerance_minutes: number | null;
  max_score: number;
  classroom_id: string;
  subject_id: string;
  semester_id: string;
  classrooms: { name: string } | null;
  subjects: { name: string } | null;
}

export interface SubmissionItem {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string | null;
  file_path: string | null;
  status: 'not_submitted' | 'submitted' | 'late' | 'graded';
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  students: { nis: string; profiles: { name: string } | null } | null;
}

export interface MemberItem {
  classroom_id: string;
  student_id: string;
  students: { nis: string; profiles: { name: string } | null } | null;
}

interface RosterRow {
  studentId: string;
  nis: string;
  name: string;
  submission: SubmissionItem | null;
}

const STATUS_LABEL = { draft: 'Draf', published: 'Dibuka', closed: 'Ditutup' } as const;
const STATUS_VARIANT = { draft: 'neutral', published: 'success', closed: 'warning' } as const;
const SUB_LABEL = { not_submitted: 'Belum', submitted: 'Terkumpul', late: 'Terlambat', graded: 'Dinilai' } as const;
const SUB_VARIANT = { not_submitted: 'neutral', submitted: 'info', late: 'warning', graded: 'success' } as const;

/** ISO -> "YYYY-MM-DDTHH:mm" waktu Jakarta untuk input datetime-local. */
function toJakartaLocal(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

interface FormState {
  id: string | null;
  title: string;
  description: string;
  instructions: string;
  assignmentKey: string;
  dueLocal: string;
  status: 'draft' | 'published' | 'closed';
  allowLate: boolean;
  toleranceMinutes: string;
  maxScore: string;
  hasFile: boolean;
  removeFile: boolean;
}

const emptyForm = (key: string): FormState => ({
  id: null, title: '', description: '', instructions: '', assignmentKey: key, dueLocal: '',
  status: 'draft', allowLate: true, toleranceMinutes: '', maxScore: '100', hasFile: false, removeFile: false,
});

export function TugasClient({
  initialAssignments,
  submissions,
  members,
  teachingAssignments,
}: {
  initialAssignments: AssignmentItem[];
  submissions: SubmissionItem[];
  members: MemberItem[];
  teachingAssignments: TeachingAssignmentRef[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState<FormState>(emptyForm(teachingAssignments[0]?.id ?? ''));
  const [formOpen, setFormOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [viewing, setViewing] = React.useState<AssignmentItem | null>(null);
  const [grading, setGrading] = React.useState<{ submission: SubmissionItem; max: number } | null>(null);
  const [score, setScore] = React.useState('');
  const [feedback, setFeedback] = React.useState('');
  const [toDelete, setToDelete] = React.useState<AssignmentItem | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const statsFor = (a: AssignmentItem) => {
    const subs = submissions.filter((s) => s.assignment_id === a.id && s.status !== 'not_submitted');
    const total = members.filter((m) => m.classroom_id === a.classroom_id).length;
    return { submitted: subs.length, graded: subs.filter((s) => s.status === 'graded').length, total };
  };

  const roster: RosterRow[] = React.useMemo(() => {
    if (!viewing) return [];
    return members
      .filter((m) => m.classroom_id === viewing.classroom_id)
      .map((m) => ({
        studentId: m.student_id,
        nis: m.students?.nis ?? '-',
        name: m.students?.profiles?.name ?? '-',
        submission: submissions.find((s) => s.assignment_id === viewing.id && s.student_id === m.student_id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [viewing, members, submissions]);

  const openCreate = () => {
    setForm(emptyForm(teachingAssignments[0]?.id ?? ''));
    setFile(null);
    setFormOpen(true);
  };

  const openEdit = (a: AssignmentItem) => {
    const key =
      teachingAssignments.find((t) => t.classroom.id === a.classroom_id && t.subject.id === a.subject_id && t.semester_id === a.semester_id)?.id ?? '';
    setForm({
      id: a.id, title: a.title, description: a.description, instructions: a.instructions ?? '', assignmentKey: key,
      dueLocal: toJakartaLocal(a.due_at), status: a.status, allowLate: a.allow_late_submission,
      toleranceMinutes: a.late_tolerance_minutes?.toString() ?? '', maxScore: String(a.max_score),
      hasFile: Boolean(a.file_path), removeFile: false,
    });
    setFile(null);
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scope = teachingAssignments.find((t) => t.id === form.assignmentKey);
    if (!scope) return toast.error('Pilih kelas dan mapel yang Anda ampu.');
    if (!form.dueLocal) return toast.error('Batas waktu wajib diisi.');
    const payload = {
      title: form.title,
      description: form.description,
      instructions: form.instructions,
      classroom_id: scope.classroom.id,
      subject_id: scope.subject.id,
      semester_id: scope.semester_id,
      due_at: `${form.dueLocal}:00+07:00`,
      status: form.status,
      allow_late_submission: form.allowLate,
      late_tolerance_minutes: form.allowLate && form.toleranceMinutes !== '' ? Number(form.toleranceMinutes) : null,
      max_score: Number(form.maxScore),
    };
    startTransition(async () => {
      const res = form.id
        ? await updateAssignmentAction({ ...payload, id: form.id, remove_file: form.removeFile }, file)
        : await createAssignmentAction(payload, file);
      if (res.success) {
        toast.success(res.message);
        setFormOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const runAction = (fn: () => Promise<{ success: boolean; message?: string; error?: string }>, after?: () => void) => {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(res.message);
        after?.();
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const openGrade = (submission: SubmissionItem, max: number) => {
    setGrading({ submission, max });
    setScore(submission.score?.toString() ?? '');
    setFeedback(submission.feedback ?? '');
  };

  const submitGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grading) return;
    const value = Number(score);
    if (Number.isNaN(value) || value < 0 || value > grading.max) {
      toast.error(`Nilai harus antara 0 dan ${grading.max}.`);
      return;
    }
    runAction(() => gradeSubmissionAction({ submission_id: grading.submission.id, score: value, feedback }), () => setGrading(null));
  };

  if (teachingAssignments.length === 0 && initialAssignments.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
        Anda belum memiliki penugasan mengajar pada semester aktif. Hubungi admin untuk menambahkan penugasan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="h-9 text-xs" onClick={openCreate} disabled={teachingAssignments.length === 0}>
          <Plus className="size-3.5" /> Tugas Baru
        </Button>
      </div>

      <ZebraDataTable<AssignmentItem>
        data={initialAssignments}
        keyExtractor={(a) => a.id}
        emptyText="Belum ada tugas aktif."
        columns={[
          {
            header: 'Tugas',
            cell: (a) => (
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{a.title}</div>
                <div className="text-xs text-muted-foreground">
                  {a.classrooms?.name ?? '-'} · {a.subjects?.name ?? '-'} · maks. {a.max_score}
                </div>
              </div>
            ),
          },
          {
            header: 'Batas Waktu',
            cell: (a) => (
              <div className="space-y-0.5">
                <div className="font-mono text-xs">{formatDateTime(a.due_at)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {a.allow_late_submission
                    ? a.late_tolerance_minutes !== null
                      ? `Toleransi ${a.late_tolerance_minutes} menit`
                      : 'Terlambat diterima'
                    : 'Tanpa keterlambatan'}
                </div>
              </div>
            ),
          },
          { header: 'Status', cell: (a) => <StatusBadge status={STATUS_LABEL[a.status]} variant={STATUS_VARIANT[a.status]} size="sm" /> },
          {
            header: 'Pengumpulan',
            isMono: true,
            cell: (a) => {
              const s = statsFor(a);
              return `${s.submitted}/${s.total} · ${s.graded} dinilai`;
            },
          },
          {
            header: 'Aksi',
            align: 'right',
            cell: (a) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setViewing(a)}>
                  <Users className="size-3.5" /> Pengumpulan
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Aksi tugas ${a.title}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(a)}><Pencil className="size-3.5" /> Ubah</DropdownMenuItem>
                    {a.status === 'published' && (
                      <DropdownMenuItem onClick={() => runAction(() => closeAssignmentAction(a.id))}>
                        <Lock className="size-3.5" /> Tutup pengumpulan
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(a)}>
                      <Trash2 className="size-3.5" /> Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
        ]}
      />

      {/* Form tugas */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{form.id ? 'Ubah Tugas' : 'Tugas Baru'}</DialogTitle>
              <DialogDescription className="text-xs">
                Waktu dalam WIB. Status keterlambatan murid ditentukan otomatis oleh jam server.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="t-title" className="text-xs">Judul</Label>
              <Input id="t-title" value={form.title} onChange={(e) => update('title', e.target.value)} required minLength={3} maxLength={160} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Kelas · Mapel</Label>
                <Select value={form.assignmentKey} onValueChange={(v) => update('assignmentKey', v)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Kelas dan mapel"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {teachingAssignments.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">{t.classroom.name} · {t.subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => update('status', v as FormState['status'])}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Status tugas"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft" className="text-xs">Draf</SelectItem>
                    <SelectItem value="published" className="text-xs">Dibuka untuk murid</SelectItem>
                    <SelectItem value="closed" className="text-xs">Ditutup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc" className="text-xs">Deskripsi</Label>
              <Textarea id="t-desc" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} required minLength={3} maxLength={5000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-instr" className="text-xs">Instruksi pengerjaan</Label>
              <Textarea id="t-instr" rows={4} value={form.instructions} onChange={(e) => update('instructions', e.target.value)} maxLength={20000} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-due" className="text-xs">Batas waktu (WIB)</Label>
                <Input id="t-due" type="datetime-local" value={form.dueLocal} onChange={(e) => update('dueLocal', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-max" className="text-xs">Skor maksimal</Label>
                <Input id="t-max" type="number" min={1} max={100} value={form.maxScore} onChange={(e) => update('maxScore', e.target.value)} required />
              </div>
            </div>
            <div className="rounded-lg border border-border/80 p-3 space-y-3">
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={form.allowLate} onCheckedChange={(v) => update('allowLate', v === true)} />
                Terima pengumpulan setelah batas waktu (ditandai terlambat)
              </label>
              {form.allowLate && (
                <div className="space-y-1.5">
                  <Label htmlFor="t-tol" className="text-xs">Toleransi keterlambatan (menit, kosongkan = tanpa batas)</Label>
                  <Input id="t-tol" type="number" min={0} max={43200} value={form.toleranceMinutes} onChange={(e) => update('toleranceMinutes', e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-file" className="text-xs">Lampiran (opsional)</Label>
              <Input id="t-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {form.id && form.hasFile && !file && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={form.removeFile} onCheckedChange={(v) => update('removeFile', v === true)} />
                  Hapus lampiran yang sudah ada
                </label>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan Tugas'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Daftar pengumpulan */}
      <Sheet open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">{viewing?.title}</SheetTitle>
            <SheetDescription className="text-xs">
              {viewing?.classrooms?.name} · batas {formatDateTime(viewing?.due_at ?? null)}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-3">
            {viewing?.file_path && <LmsFileButton kind="assignment" id={viewing.id} label="Lampiran tugas" />}
            <ZebraDataTable<RosterRow>
              data={roster}
              keyExtractor={(r) => r.studentId}
              emptyText="Belum ada murid aktif di kelas ini."
              columns={[
                { header: 'NIS', accessorKey: 'nis', isMono: true },
                { header: 'Nama', accessorKey: 'name' },
                {
                  header: 'Status',
                  cell: (r) => {
                    const st = r.submission?.status ?? 'not_submitted';
                    return <StatusBadge status={SUB_LABEL[st]} variant={SUB_VARIANT[st]} size="sm" />;
                  },
                },
                { header: 'Nilai', isMono: true, align: 'right', cell: (r) => r.submission?.score ?? '-' },
                {
                  header: 'Aksi',
                  align: 'right',
                  cell: (r) =>
                    r.submission && r.submission.status !== 'not_submitted' ? (
                      <div className="flex justify-end gap-1">
                        {r.submission.file_path && <LmsFileButton kind="submission" id={r.submission.id} label="Jawaban" />}
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openGrade(r.submission!, Number(viewing?.max_score ?? 100))}>
                          {r.submission.status === 'graded' ? 'Ubah nilai' : 'Nilai'}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    ),
                },
              ]}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Penilaian */}
      <Dialog open={!!grading} onOpenChange={(v) => !v && setGrading(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl">
          <form onSubmit={submitGrade} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">Nilai: {grading?.submission.students?.profiles?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                Dikumpulkan {formatDateTime(grading?.submission.submitted_at ?? null)}
                {grading?.submission.status === 'late' ? ' (terlambat)' : ''}
              </DialogDescription>
            </DialogHeader>
            {grading?.submission.answer_text && (
              <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                {grading.submission.answer_text}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="g-score" className="text-xs">Nilai (0–{grading?.max})</Label>
              <Input id="g-score" type="number" min={0} max={grading?.max} step="0.5" value={score} onChange={(e) => setScore(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-feedback" className="text-xs">Catatan evaluasi / umpan balik</Label>
              <Textarea id="g-feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={4000} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setGrading(null)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan Nilai'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Hapus tugas?</DialogTitle>
            <DialogDescription className="text-xs">
              &ldquo;{toDelete?.title}&rdquo; akan dihapus permanen. Tugas yang sudah memiliki pengumpulan tidak dapat dihapus; tutup tugas sebagai gantinya.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setToDelete(null)}>Batal</Button>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={() => toDelete && runAction(() => deleteAssignmentAction(toDelete.id), () => setToDelete(null))}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
