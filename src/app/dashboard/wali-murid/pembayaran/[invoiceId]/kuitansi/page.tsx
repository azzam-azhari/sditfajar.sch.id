import { redirect } from 'next/navigation';

export const instant = false;

/** Route roadmap lama; kuitansi kini disajikan di route bersama yang dilindungi RLS. */
export default async function LegacyReceiptPage(props: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await props.params;
  redirect(`/dashboard/kuitansi/${encodeURIComponent(invoiceId)}`);
}
