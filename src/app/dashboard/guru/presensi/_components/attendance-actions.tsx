'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/common/status-badge';
import { recordTeacherAttendanceAction, updateWeekendAttendanceAction } from '@/actions/lms.actions';

interface AttendanceActionsProps {
  checkIn: { time: string; status: string } | null;
  checkOut: { time: string } | null;
  isWeekend: boolean;
  weekendEnabled: boolean;
}

export function AttendanceActions({ checkIn, checkOut, isWeekend, weekendEnabled }: AttendanceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const record = (session: 'check_in' | 'check_out') => {
    startTransition(async () => {
      const res = await recordTeacherAttendanceAction(session);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const blockedWeekend = isWeekend && !weekendEnabled;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/80 p-3 space-y-1">
          <div className="text-[11px] text-muted-foreground">Check-in</div>
          {checkIn ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-semibold">{checkIn.time}</span>
              <StatusBadge
                status={checkIn.status === 'late' ? 'Terlambat' : 'Tepat waktu'}
                variant={checkIn.status === 'late' ? 'warning' : 'success'}
                size="sm"
              />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Belum</span>
          )}
        </div>
        <div className="rounded-lg border border-border/80 p-3 space-y-1">
          <div className="text-[11px] text-muted-foreground">Check-out</div>
          {checkOut ? (
            <span className="font-mono text-lg font-semibold">{checkOut.time}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Belum</span>
          )}
        </div>
      </div>

      {blockedWeekend ? (
        <p className="rounded-lg border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
          Hari ini akhir pekan. Presensi guru akhir pekan belum diaktifkan oleh kepala sekolah.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-9 text-xs" disabled={isPending || Boolean(checkIn)} onClick={() => record('check_in')}>
            <LogIn className="size-3.5" /> Check-in
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            disabled={isPending || !checkIn || Boolean(checkOut)}
            onClick={() => record('check_out')}
          >
            <LogOut className="size-3.5" /> Check-out
          </Button>
        </div>
      )}
    </div>
  );
}

export function WeekendToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const change = (value: boolean) => {
    startTransition(async () => {
      const res = await updateWeekendAttendanceAction(value);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <label className="flex items-start gap-3 rounded-lg border border-border/80 p-3 text-xs">
      <Checkbox
        checked={enabled}
        disabled={isPending}
        onCheckedChange={(v) => change(v === true)}
        aria-label="Aktifkan presensi guru akhir pekan"
      />
      <span className="space-y-0.5">
        <span className="block font-medium text-foreground">Izinkan presensi guru pada Sabtu & Minggu</span>
        <span className="block text-muted-foreground">
          Saat ini: {enabled ? 'aktif' : 'nonaktif'}. Presensi murid tetap hanya Senin–Jumat.
        </span>
      </span>
    </label>
  );
}
