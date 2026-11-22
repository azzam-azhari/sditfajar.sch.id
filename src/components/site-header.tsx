"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/common/theme-toggle"
import Link from "next/link"
import { AcademicYearSelect, type AcademicYearOption } from "@/components/academic-year-select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const ROLE_SEGMENTS = ["super-admin", "admin", "guru", "murid", "wali-murid"]

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "super-admin": "Super Admin",
  admin: "Admin",
  guru: "Guru",
  murid: "Murid",
  "wali-murid": "Wali Murid",
  users: "Manajemen Pengguna",
  roles: "Jabatan Guru",
  settings: "Identitas Sekolah",
  "audit-logs": "Audit Log",
  import: "Import CSV",
  pembayaran: "Pembayaran",
  pendaftaran: "Verifikasi SPMB",
  "tahun-ajaran": "Tahun Ajaran & Periode",
  rombel: "Rombel & Kelas",
  mapel: "Mata Pelajaran",
  penugasan: "Penugasan Mengajar",
  siswa: "Data Murid",
  berita: "Berita Sekolah",
  tagihan: "Tagihan & Pembayaran",
  materi: "Materi",
  tugas: "Tugas",
  nilai: "Nilai",
  presensi: "Presensi",
  "presensi-siswa": "Presensi Murid",
  tahfidz: "Tahfidz",
  keuangan: "Keuangan",
  jadwal: "Jadwal",
  pengumuman: "Pengumuman",
  marketplace: "Marketplace",
  kuitansi: "Kuitansi",
  anak: "Data Anak",
  absensi: "Presensi Anak",
}

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  // Segmen dinamis (UUID / angka / id panjang) tampil sebagai "Detail".
  if (/^[0-9a-f-]{8,}$/i.test(segment) || /\d/.test(segment)) return "Detail"
  const text = decodeURIComponent(segment).replace(/-/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function buildCrumbs(pathname: string): { href: string; label: string }[] {
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = segments.map((segment, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: labelFor(segment),
  }))
  // /dashboard/<role>/... → mulai dari role; root role tampil "<Role> › Dashboard".
  if (segments[0] === "dashboard" && ROLE_SEGMENTS.includes(segments[1])) {
    const rest = crumbs.slice(1)
    if (rest.length === 1) rest.push({ href: rest[0].href, label: "Dashboard" })
    return rest
  }
  return crumbs
}

export function SiteHeader({ academicYears }: { academicYears?: AcademicYearOption[] }) {
  const pathname = usePathname()
  const crumbs = buildCrumbs(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b rounded-t-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mx-1 shrink-0 sm:mx-2 data-vertical:h-4 data-vertical:self-center"
          />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1
                return (
                  <React.Fragment key={`${crumb.href}-${i}`}>
                    {i > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                    <BreadcrumbItem className={isLast ? "min-w-0" : "hidden md:inline-flex"}>
                      {isLast ? (
                        <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {academicYears && <AcademicYearSelect years={academicYears} />}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
