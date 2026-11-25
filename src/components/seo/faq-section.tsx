import { HelpCircle } from "lucide-react";
import type { FaqItem } from "@/lib/seo/faq";
import { JsonLd, faqSchema } from "@/components/seo/json-ld";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    <section className="w-full" aria-labelledby="faq-heading">
      <JsonLd data={faqSchema(items)} />
      <div className="text-center mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</span>
        <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-foreground md:text-3xl mt-1">
          {title}
        </h2>
      </div>

      <Accordion type="single" collapsible defaultValue="faq-0" className="gap-3">
        {items.map((f, i) => (
          <AccordionItem
            key={f.q}
            value={`faq-${i}`}
            className="rounded-xl border border-border/80 bg-card px-5 transition-shadow data-[state=open]:shadow-xs"
          >
            <AccordionTrigger className="items-center gap-3 py-4 text-sm font-semibold text-foreground hover:no-underline">
              <span className="flex flex-1 items-start gap-2">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {f.q}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pl-6 text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
