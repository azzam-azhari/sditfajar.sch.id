'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import {
  createAnnouncementAction, deleteAnnouncementAction, updateAnnouncementAction,
} from '@/actions/announcement.actions';
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/constants/auth';
import { formatDateTime } from '@/lib/date';

type TargetType = 'all' | 'role' | 'class' | 'student';
type Status = 'draft' | 'published' | 'archived';

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  target_type: TargetType;
  target_role: UserRole | null;
  classroom_id: string | null;
  student_id: string | null;
  status: Status;
  published_at: string | null;
  created_at: string;
  created_by: string;
  classrooms: { name: string } | null;
  students: { nis: string; profiles: { name: string } | null } | null;
  profiles: { name: string } | null;
}

const STATUS_LABEL: Record<Status, string> = { draft: 'Draf', published: 'Terbit', archived: 'Arsip' };
const STATUS_VARIANT = { draft: 'neutral', published: 'success', archived: 'warning' } as const;
const TARGET_LABEL: Record<TargetType, string> = { all: 'Semua', role: 'Peran', class: 'Kelas', student: 'Murid' };

interface FormState {
  id: string | null;
  title: string;
  content: string;
  target_type: TargetType;
  target_role: UserRole;
  classroom_id: string;
  student_id: string;
  status: Status;
}

export function AnnouncementManager({
  currentUserId,
  canManageAll,
  rows,
  classrooms,
  students,
}: {
  currentUserId: string;
  canManageAll: boolean;
  rows: AnnouncementRow[];
  classrooms: { id: string; name: string }[];
  students: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<AnnouncementRow | null>(null);
  const blank: FormState = {
    id: null, title: '', content: '', target_type: 'all', target_role: 'wali_murid',
    classroom_id: classrooms[0]?.id ?? '', student_id: students[0]?.id ?? '', status: 'published',
  };
  const [form, setForm] = React.useState<FormState>(blank);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const targetText = (r: AnnouncementRow) => {
    if (r.target_type === 'role') return `Peran: ${r.target_role ? ROLE_LABELS[r.target_role] : '-'}`;
    if (r.target_type === 'class') return `Kelas: ${r.classrooms?.name ?? '-'}`;
    if (r.target_type === 'student') return `Murid: ${r.students?.profiles?.name ?? '-'}`;
    return 'Semua warga sekolah';
  };

  const canEdit = (r: AnnouncementRow) => canManageAll || r.created_by === currentUserId;

  const openEdit = (r: AnnouncementRow) => {
    setForm({
      id: r.id, title: r.title, content: r.content, target_type: r.target_type,
      target_role: r.target_role ?? 'wali_murid', classroom_id: r.classroom_id ?? blank.classroom_id,
      student_id: r.student_id ?? blank.student_id, status: r.status,
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      content: form.content,
      target_type: form.target_type,
      target_role: form.target_type === 'role' ? form.target_role : null,
      classroom_id: form.target_type === 'class' ? form.classroom_id || null : null,
      student_id: form.target_type === 'student' ? form.student_id || null : null,
      status: form.status,
    };
    startTransition(async () => {
      const res = form.id ? await updateAnnouncementAction({ ...payload, id: form.id }) : await createAnnouncementAction(payload);
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
      const res = await deleteAnnouncementAction(toDelete.id);
      if (res.success) {
        toast.success(res.message);
        setToDelete(null);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="h-9 text-xs" onClick={() => { setForm(blank); setOpen(true); }}>
          <Plus className="size-3.5" /> Pengumuman Baru
        </Button>
      </div>

      <ZebraDataTable<AnnouncementRow>
        data={rows}
        keyExtractor={(r) => r.id}
        emptyText="Belum ada pengumuman."
        columns={[
          {
            header: 'Pengumuman',
            cell: (r) => (
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{r.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{r.content}</div>
              </div>
            ),
          },
          { header: 'Target', cell: (r) => <span className="text-xs">{targetText(r)}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={STATUS_LABEL[r.status]} variant={STATUS_VARIANT[r.status]} size="sm" /> },
          { header: 'Terbit', isMono: true, cell: (r) => formatDateTime(r.published_at) },
          { header: 'Pembuat', cell: (r) => <span className="text-xs">{r.profiles?.name ?? '-'}</span> },
          {
            header: 'Aksi',
            align: 'right',
            cell: (r) =>
              canEdit(r) ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={`Ubah ${r.title}`} onClick={() => openEdit(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" aria-label={`Hapus ${r.title}`} onClick={() => setToDelete(r)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm">{form.id ? 'Ubah Pengumuman' : 'Pengumuman Baru'}</DialogTitle>
              <DialogDescription className="text-xs">Target kelas dan murid juga terlihat oleh wali murid terkait.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="a-title" className="text-xs">Judul</Label>
              <Input id="a-title" value={form.title} onChange={(e) => update('title', e.target.value)} required minLength={3} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-content" className="text-xs">Isi pengumuman</Label>
              <Textarea id="a-content" rows={6} value={form.content} onChange={(e) => update('content', e.target.value)} required minLength={3} maxLength={10000} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Target</Label>
                <Select value={form.target_type} onValueChange={(v) => update('target_type', v as TargetType)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Target pengumuman"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TARGET_LABEL) as TargetType[]).map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t === 'all' ? 'Semua warga sekolah' : `Per ${TARGET_LABEL[t].toLowerCase()}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => update('status', v as Status)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Status pengumuman"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published" className="text-xs">Terbitkan</SelectItem>
                    <SelectItem value="draft" className="text-xs">Draf</SelectItem>
                    <SelectItem value="archived" className="text-xs">Arsip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.target_type === 'role' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Peran tujuan</Label>
                <Select value={form.target_role} onValueChange={(v) => update('target_role', v as UserRole)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Peran tujuan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.target_type === 'class' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Kelas tujuan</Label>
                <Select value={form.classroom_id} onValueChange={(v) => update('classroom_id', v)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Kelas tujuan"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.target_type === 'student' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Murid tujuan</Label>
                <Select value={form.student_id} onValueChange={(v) => update('student_id', v)}>
                  <SelectTrigger className="h-9 w-full text-xs" aria-label="Murid tujuan"><SelectValue placeholder="Pilih murid" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Menyimpan…' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Hapus pengumuman?</DialogTitle>
            <DialogDescription className="text-xs">&ldquo;{toDelete?.title}&rdquo; akan dihapus permanen.</DialogDescription>
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
