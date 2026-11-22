'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLmsFileUrlAction } from '@/actions/lms.actions';

interface LmsFileButtonProps {
  kind: 'material' | 'assignment' | 'submission';
  id: string;
  label?: string;
}

/** Membuka berkas privat bucket `lms-files` lewat signed URL berumur pendek. */
export function LmsFileButton({ kind, id, label = 'Buka Berkas' }: LmsFileButtonProps) {
  const [isPending, startTransition] = React.useTransition();

  const handleOpen = () => {
    // Buka tab lebih dulu agar tidak diblokir popup blocker.
    const win = window.open('about:blank', '_blank');
    startTransition(async () => {
      const res = await getLmsFileUrlAction({ kind, id });
      if (res.success) {
        if (win) win.location.href = res.data.url;
        else window.open(res.data.url, '_blank', 'noopener,noreferrer');
      } else {
        win?.close();
        toast.error(res.error);
      }
    });
  };

  return (
    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleOpen} disabled={isPending}>
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
      {label}
    </Button>
  );
}
