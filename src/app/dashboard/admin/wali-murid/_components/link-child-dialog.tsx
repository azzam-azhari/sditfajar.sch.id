'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { linkParentStudentAction } from '@/actions/parent.actions';
import { PARENT_RELATIONSHIPS } from '@/validations/parent.schema';

export interface StudentOption {
  id: string;
  nis: string;
  name: string;
  className: string | null;
}

type Relationship = (typeof PARENT_RELATIONSHIPS)[number];

const MAX_RESULTS = 50;

export function LinkChildDialog({
  parentId,
  parentName,
  students,
  linkedStudentIds,
}: {
  parentId: string;
  parentName: string;
  students: StudentOption[];
  linkedStudentIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [studentId, setStudentId] = React.useState<string | null>(null);
  const [relationship, setRelationship] = React.useState<Relationship>('Orang Tua');
  const [isPending, startTransition] = React.useTransition();

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => !linkedStudentIds.includes(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.nis.includes(q))
      .slice(0, MAX_RESULTS);
  }, [students, linkedStudentIds, query]);

  const reset = () => {
    setQuery('');
    setStudentId(null);
    setRelationship('Orang Tua');
  };

  const save = () => {
    if (!studentId) {
      toast.error('Pilih murid yang akan ditautkan.');
      return;
    }
    startTransition(async () => {
      const res = await linkParentStudentAction({ parent_id: parentId, student_id: studentId, relationship });
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1">
          <Link2 className="size-3" />
          Tautkan Anak
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Tautkan anak ke {parentName}</DialogTitle>
          <DialogDescription className="text-xs">
            Satu akun wali dapat terhubung ke beberapa anak. Wali akan melihat data anak ini di dashboard-nya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              aria-label="Cari murid"
              placeholder="Cari nama atau NIS murid"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <ul role="listbox" aria-label="Daftar murid" className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {results.length === 0 && (
              <li className="p-3 text-xs text-muted-foreground text-center">Murid tidak ditemukan.</li>
            )}
            {results.map((s) => {
              const selected = s.id === studentId;
              return (
                <li key={s.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => setStudentId(s.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60',
                      selected && 'bg-primary/10'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground truncate">{s.name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        NIS {s.nis}
                        {s.className ? ` · ${s.className}` : ''}
                      </span>
                    </span>
                    {selected && <Check className="size-4 text-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-1">
            <Label className="text-xs">Hubungan dengan murid</Label>
            <Select value={relationship} onValueChange={(v) => setRelationship(v as Relationship)}>
              <SelectTrigger aria-label="Hubungan dengan murid" className="h-8 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARENT_RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" size="sm" className="text-xs h-8" onClick={save} disabled={isPending || !studentId}>
            {isPending ? 'Menyimpan…' : 'Tautkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
