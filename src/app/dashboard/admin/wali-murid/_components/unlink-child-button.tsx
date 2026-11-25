'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { unlinkParentStudentAction } from '@/actions/parent.actions';

export function UnlinkChildButton({
  linkId,
  childName,
  parentName,
}: {
  linkId: string;
  childName: string;
  parentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const unlink = () =>
    startTransition(async () => {
      const res = await unlinkParentStudentAction(linkId);
      if (res.success) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Lepas ${childName} dari ${parentName}`}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Lepas tautan anak?</DialogTitle>
          <DialogDescription className="text-xs">
            {childName} akan dilepas dari akun wali {parentName}. Wali tidak bisa lagi melihat data anak ini.
            Data murid tidak dihapus dan dapat ditautkan kembali.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" className="text-xs h-8" disabled={isPending}>
              Batal
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" size="sm" className="text-xs h-8" onClick={unlink} disabled={isPending}>
            {isPending ? 'Melepas…' : 'Lepas Tautan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
