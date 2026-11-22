'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { LmsFileButton } from '@/components/lms/lms-file-button';
import { submitAssignmentAction } from '@/actions/lms.actions';
import { formatDateTime } from '@/lib/date';
import type { AssignmentView } from '@/lib/data/student-overview';

function canSubmit(a: AssignmentView, now: number): { ok: boolean; reason?: string } {
  if (a.status !== 'published') return { ok: false, reason: 'Tugas sudah ditutup guru.' };
  if (a.submission?.status === 'graded') return { ok: false, reason: 'Tugas sudah dinilai.' };
  if (a.due_at && new Date(a.due_at).getTime() < now) {
    if (!a.allow_late_submission) return { ok: false, reason: 'Batas waktu sudah lewat.' };
    if (a.late_tolerance_minutes !== null) {
      const limit = new Date(a.due_at).getTime() + a.late_tolerance_minutes * 60_000;
      if (limit < now) return { ok: false, reason: 'Batas toleransi keterlambatan sudah lewat.' };
    }
  }
  return { ok: true };
}

export function SubmitAssignmentDialog({ assignment }: { assignment: AssignmentView }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState(assignment.submission?.answer_text ?? '');
  const [file, setFile] = React.useState<File | null>(null);
  const [isPending, startTransition] = React.useTransition();
  // Waktu acuan dibekukan saat komponen dibuat; server tetap memvalidasi ulang.
  const [now] = React.useState(() => Date.now());
  const status = canSubmit(assignment, now);
  const submitted = assignment.submission && assignment.submission.status !== 'not_submitted';
  const isLateNow = assignment.due_at ? new Date(assignment.due_at).getTime() < now : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() && !file && !assignment.submission?.file_path) {
      toast.error('Isi jawaban teks atau pilih berkas.');
      return;
    }
    startTransition(async () => {
      const res = await submitAssignmentAction({ assignment_id: assignment.id, answer_text: answer }, file);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        setFile(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <>
      <Button size="sm" variant={submitted ? 'outline' : 'default'} className="h-7 text-xs" onClick={() => setOpen(true)}>
        {status.ok ? (submitted ? 'Perbarui' : 'Kumpulkan') : 'Detail'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{assignment.title}</DialogTitle>
              <DialogDescription className="text-xs">
                {assignment.subjects?.name ?? '-'} · batas {formatDateTime(assignment.due_at)} · skor maks. {assignment.max_score}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-xs">
              <p className="text-foreground whitespace-pre-wrap">{assignment.description}</p>
              {assignment.instructions && (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 whitespace-pre-wrap">{assignment.instructions}</div>
              )}
              {assignment.file_path && <LmsFileButton kind="assignment" id={assignment.id} label="Lampiran guru" />}
            </div>

            {assignment.submission?.status === 'graded' && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1">
                <div className="font-semibold">Nilai: <span className="font-mono">{assignment.submission.score}/{assignment.max_score}</span></div>
                {assignment.submission.feedback && <p className="whitespace-pre-wrap text-muted-foreground">{assignment.submission.feedback}</p>}
              </div>
            )}

            {submitted && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Terakhir dikumpulkan {formatDateTime(assignment.submission?.submitted_at ?? null)}</span>
                {assignment.submission?.file_path && <LmsFileButton kind="submission" id={assignment.submission.id} label="Berkas saya" />}
              </div>
            )}

            {status.ok ? (
              <>
                {isLateNow && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                    Batas waktu sudah lewat. Pengumpulan sekarang akan ditandai terlambat.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor={`ans-${assignment.id}`} className="text-xs">Jawaban</Label>
                  <Textarea id={`ans-${assignment.id}`} rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={20000} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`file-${assignment.id}`} className="text-xs">
                    Berkas jawaban {assignment.submission?.file_path ? '(kosongkan untuk mempertahankan berkas lama)' : '(opsional)'}
                  </Label>
                  <Input id={`file-${assignment.id}`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-border/80 p-3 text-xs text-muted-foreground">{status.reason}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Tutup</Button>
              {status.ok && (
                <Button type="submit" size="sm" disabled={isPending}>
                  <Upload className="size-3.5" /> {isPending ? 'Mengirim…' : submitted ? 'Perbarui Jawaban' : 'Kumpulkan'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
