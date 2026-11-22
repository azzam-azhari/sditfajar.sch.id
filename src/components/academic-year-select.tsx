"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setActiveAcademicYearAction } from "@/actions/academic.actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type AcademicYearOption = { id: string; name: string; is_active: boolean }

export function AcademicYearSelect({ years }: { years: AcademicYearOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const activeId = years.find((y) => y.is_active)?.id

  if (years.length === 0) return null

  function handleChange(id: string) {
    if (id === activeId) return
    startTransition(async () => {
      const res = await setActiveAcademicYearAction(id)
      if (res.success) {
        toast.success(res.message)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Select value={activeId} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="h-9 w-36 text-xs" aria-label="Tahun ajaran aktif">
        <SelectValue placeholder="Tahun ajaran" />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y.id} value={y.id} className="text-xs">
            {y.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
