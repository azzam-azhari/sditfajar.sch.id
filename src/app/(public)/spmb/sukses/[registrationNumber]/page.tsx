import { Suspense } from "react";
import { getPublicSpmbInfo } from "@/lib/data/spmb";
import { SuccessReceipt } from "./_components/success-receipt";

async function Receipt({ params }: { params: Promise<{ registrationNumber: string }> }) {
  const [{ registrationNumber }, info] = await Promise.all([params, getPublicSpmbInfo()]);
  return (
    <SuccessReceipt
      regNumber={decodeURIComponent(registrationNumber)}
      academicYearName={info.academicYearName}
    />
  );
}

export default function PendaftaranSuksesPage({
  params,
}: {
  params: Promise<{ registrationNumber: string }>;
}) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-8 h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Receipt params={params} />
    </Suspense>
  );
}
