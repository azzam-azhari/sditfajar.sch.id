import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Kartu bagian dashboard bergaya Minimalist Craft (border tipis, padding presisi). */
export function SectionCard({ title, description, action, children, className }: SectionCardProps) {
  return (
    <section className={cn('rounded-xl border border-border/80 bg-card p-5 space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
