import { DAY_LABELS, formatTime, jakartaIsoDow } from '@/lib/date';
import { cn } from '@/lib/utils';

export interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  classroom_id: string;
  subject_id: string;
  teacher_id: string;
  classrooms: { name: string } | null;
  subjects: { name: string } | null;
  teachers: { profiles: { name: string } | null } | null;
}

interface WeeklyScheduleProps {
  slots: ScheduleSlot[];
  showClass?: boolean;
  showTeacher?: boolean;
}

/** Grid jadwal mingguan Senin–Jumat (bertumpuk di layar kecil). */
export function WeeklySchedule({ slots, showClass, showTeacher }: WeeklyScheduleProps) {
  const today = jakartaIsoDow();
  const days = [1, 2, 3, 4, 5];

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
        Belum ada jadwal pelajaran.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {days.map((day) => {
        const daySlots = slots
          .filter((s) => s.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div
            key={day}
            className={cn(
              'rounded-xl border border-border/80 bg-card p-3 space-y-2',
              day === today && 'border-primary/50'
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{DAY_LABELS[day]}</h3>
              {day === today && <span className="text-[10px] font-medium text-primary">Hari ini</span>}
            </div>
            {daySlots.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Tidak ada pelajaran.</p>
            ) : (
              <ul className="space-y-1.5">
                {daySlots.map((s, i) => (
                  <li
                    key={s.id}
                    className={cn('rounded-lg border border-border/60 px-2.5 py-2', i % 2 === 1 && 'bg-muted/25 dark:bg-muted/15')}
                  >
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      {s.room ? ` · ${s.room}` : ''}
                    </div>
                    <div className="text-xs font-medium text-foreground">{s.subjects?.name ?? '-'}</div>
                    {showClass && <div className="text-[11px] text-muted-foreground">{s.classrooms?.name ?? '-'}</div>}
                    {showTeacher && <div className="text-[11px] text-muted-foreground">{s.teachers?.profiles?.name ?? '-'}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
