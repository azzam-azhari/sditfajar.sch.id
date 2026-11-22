"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckIcon, EyeIcon, EyeOffIcon, Loader2, XIcon } from "lucide-react"
import { updatePasswordAction } from "@/actions/auth.actions"
import { PASSWORD_RULES, updatePasswordSchema } from "@/validations/auth.schema"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Field = "currentPassword" | "newPassword" | "confirmPassword"
const EMPTY: Record<Field, string> = { currentPassword: "", newPassword: "", confirmPassword: "" }

const FIELDS: { name: Field; label: string; autoComplete: string }[] = [
  { name: "currentPassword", label: "Password lama", autoComplete: "current-password" },
  { name: "newPassword", label: "Password baru", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Konfirmasi password baru", autoComplete: "new-password" },
]

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [values, setValues] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({})
  const [show, setShow] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function handleOpenChange(next: boolean) {
    if (pending) return
    if (!next) {
      // Jangan simpan password di memori setelah dialog ditutup.
      setValues(EMPTY)
      setErrors({})
      setShow(false)
    }
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = updatePasswordSchema.safeParse(values)
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      setErrors({
        currentPassword: fe.currentPassword?.[0],
        newPassword: fe.newPassword?.[0],
        confirmPassword: fe.confirmPassword?.[0],
      })
      return
    }
    setErrors({})
    startTransition(async () => {
      const res = await updatePasswordAction(parsed.data)
      if (res.success) {
        toast.success(res.message)
        setValues(EMPTY)
        setShow(false)
        onOpenChange(false)
      } else {
        const fe = res.fieldErrors as Partial<Record<Field, string[]>> | undefined
        if (fe) {
          setErrors({
            currentPassword: fe.currentPassword?.[0],
            newPassword: fe.newPassword?.[0],
            confirmPassword: fe.confirmPassword?.[0],
          })
        }
        toast.error(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Ganti Password</DialogTitle>
            <DialogDescription>
              Masukkan password lama Anda, lalu buat password baru yang kuat. Sesi di perangkat lain akan dikeluarkan.
            </DialogDescription>
          </DialogHeader>

          {FIELDS.map((f) => (
            <div key={f.name} className="grid gap-1.5">
              <Label htmlFor={f.name}>{f.label}</Label>
              <div className="relative">
                <Input
                  id={f.name}
                  name={f.name}
                  type={show ? "text" : "password"}
                  autoComplete={f.autoComplete}
                  maxLength={72}
                  value={values[f.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  aria-invalid={!!errors[f.name]}
                  aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
                  disabled={pending}
                  className="pr-10"
                />
                {f.name === "currentPassword" && (
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                )}
              </div>
              {errors[f.name] && (
                <p id={`${f.name}-error`} className="text-xs text-destructive">
                  {errors[f.name]}
                </p>
              )}
              {f.name === "newPassword" && (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-xs">
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(values.newPassword)
                    return (
                      <li key={r.label} className={`flex items-center gap-1 ${ok ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {ok ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
                        {r.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Simpan Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
