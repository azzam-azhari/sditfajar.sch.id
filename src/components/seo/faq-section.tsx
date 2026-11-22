import { HelpCircle } from "lucide-react";
import type { FaqItem } from "@/lib/seo/faq";
import { JsonLd, faqSchema } from "@/components/seo/json-ld";

/** Daftar tanya-jawab yang sekaligus mengirim schema FAQPage ke Google. */
export function FaqSection({
  items,
  title = "Pertanyaan yang Sering Diajukan",
  eyebrow = "Tanya Jawab",
}: {
  items: FaqItem[];
  title?: string;
  eyebrow?: string;
}) {
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8" aria-labelledby="faq-heading">
      <JsonLd data={faqSchema(items)} />
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</span>
        <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-foreground md:text-3xl mt-1">
          {title}
        </h2>
      </div>

      <div className="space-y-3">
        {items.map((f) => (
          <details
            key={f.q}
            className="group rounded-xl border border-border/80 bg-card p-5 open:shadow-xs"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              <h3 className="flex-1">{f.q}</h3>
              <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-6">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
