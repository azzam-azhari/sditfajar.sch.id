import { requireRole } from '@/lib/supabase/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getTeacherContext, ATTENDANCE_LABELS } from '@/lib/data/lms';
import { DAY_LABELS, formatDate, jakartaIsoDow, jakartaMonth, jakartaToday, monthRange } from '@/lib/date';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { StatusBadge } from '@/components/common/status-badge';
import { ZebraDataTable } from '@/components/common/zebra-data-table';
import { SectionCard } from '@/components/lms/section-card';
import { AttendanceActions, WeekendToggle } from './_components/attendance-actions';

export const instant = false;

type AttendanceRow = { id: string; attendance_date: string; session: string; status: string; recorded_at: string };

interface DayRow {
  date: string;
  checkIn: AttendanceRow | null;
  checkOut: AttendanceRow | null;
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export default async function GuruPresensiPage() {
  const { user } = await requireRole(['guru']);
  const ctx = await getTeacherContext(user.id);
  if (!ctx) return <EmptyState title="Profil guru belum terhubung" description="Hubungi admin sekolah." />;

  const supabase = await createClient();
  const today = jakartaToday();
  const month = jakartaMonth();
  const { start, end } = monthRange(month);

  const [{ data: records }, { data: settings }] = await Promise.all([
    supabase
      .from('teacher_attendances')
      .select('id, attendance_date, session, status, recorded_at')
      .eq('teacher_id', ctx.teacherId)
      .gte('attendance_date', start)
      .lte('attendance_date', end)
      .order('attendance_date', { ascending: false }),
    supabase
      .from('school_period_settings')
      .select('teacher_weekend_attendance_enabled, academic_years!inner(is_active)')
      .eq('academic_years.is_active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = (records ?? []) as AttendanceRow[];
  const days: DayRow[] = Array.from(new Set(rows.map((r) => r.attendance_date))).map((date) => ({
    date,
    checkIn: rows.find((r) => r.attendance_date === date && r.session === 'check_in') ?? null,
    checkOut: rows.find((r) => r.attendance_date === date && r.session === 'check_out') ?? null,
  }));
  const todayRow = days.find((d) => d.date === today);
  const weekendEnabled = Boolean(settings?.teacher_weekend_attendance_enabled);
  const dow = jakartaIsoDow();
  const lateCount = days.filter((d) => d.checkIn?.status === 'late').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi Guru"
        description="Check-in 06.30–07.00 WIB tercatat tepat waktu; setelah 07.00 tetap dapat check-in hingga 23.59 dengan status terlambat. Check-out mulai 14.30 WIB. Semua waktu memakai jam server."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={`Hari ini · ${DAY_LABELS[dow]}, ${formatDate(today)}`}>
          <AttendanceActions
            checkIn={todayRow?.checkIn ? { time: clock(todayRow.checkIn.recorded_at), status: todayRow.checkIn.status } : null}
            checkOut={todayRow?.checkOut ? { time: clock(todayRow.checkOut.recorded_at) } : null}
            isWeekend={dow > 5}
            weekendEnabled={weekendEnabled}
          />
        </SectionCard>

        {ctx.isPrincipal ? (
          <SectionCard
            title="Pengaturan Presensi Akhir Pekan"
            description="Khusus kepala sekolah. Berlaku untuk seluruh guru pada tahun ajaran aktif."
          >
            <WeekendToggle enabled={weekendEnabled} />
          </SectionCard>
        ) : (
          <SectionCard title="Ringkasan Bulan Ini" description={`Periode ${month}`}>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-border/80 p-3">
                <div className="font-mono text-xl font-semibold">{days.filter((d) => d.checkIn).length}</div>
                <div className="text-[11px] text-muted-foreground">Hari hadir</div>
              </div>
              <div className="rounded-lg border border-border/80 p-3">
                <div className="font-mono text-xl font-semibold">{lateCount}</div>
                <div className="text-[11px] text-muted-foreground">Terlambat</div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      <SectionCard title="Riwayat Presensi Bulan Ini" description={`${days.length} hari tercatat · ${lateCount} terlambat`}>
        <ZebraDataTable<DayRow>
          data={days}
          keyExtractor={(d) => d.date}
          emptyText="Belum ada presensi bulan ini."
          columns={[
            { header: 'Tanggal', isMono: true, cell: (d) => formatDate(d.date) },
            {
              header: 'Check-in',
              cell: (d) =>
                d.checkIn ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{clock(d.checkIn.recorded_at)}</span>
                    <StatusBadge
                      status={ATTENDANCE_LABELS[d.checkIn.status] ?? d.checkIn.status}
                      variant={d.checkIn.status === 'late' ? 'warning' : 'success'}
                      size="sm"
                    />
                  </span>
                ) : (
                  '-'
                ),
            },
            { header: 'Check-out', isMono: true, cell: (d) => (d.checkOut ? clock(d.checkOut.recorded_at) : '-') },
          ]}
        />
      </SectionCard>
    </div>
  );
}
