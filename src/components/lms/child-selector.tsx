'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ChildSelectorProps {
  childrenList: { studentId: string; name: string; classroomName: string | null }[];
  selectedId: string;
}

/** Pemilih anak untuk wali murid dengan lebih dari satu anak (disimpan di `?anak=`). */
export function ChildSelector({ childrenList, selectedId }: ChildSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (childrenList.length < 2) return null;

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('anak', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Anak:</span>
      <Select value={selectedId} onValueChange={handleChange}>
        <SelectTrigger className="h-9 w-56 text-xs" aria-label="Pilih anak">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {childrenList.map((child) => (
            <SelectItem key={child.studentId} value={child.studentId} className="text-xs">
              {child.name}
              {child.classroomName ? ` · ${child.classroomName}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
