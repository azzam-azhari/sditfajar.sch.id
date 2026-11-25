import * as React from "react";
import { cn } from "@/lib/utils";

export interface ZebraColumn<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  isMono?: boolean;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
  /**
   * Posisi kolom pada tampilan kartu (mobileCards): "title" di kepala kartu tanpa label,
   * "full" pasangan label–nilai selebar kartu, "footer" lebar penuh di bawah (mis. tombol aksi).
   * Default: pasangan label–nilai setengah lebar.
   */
  cardSlot?: "title" | "full" | "footer";
}

export interface ZebraDataTableProps<T> {
  data: T[];
  columns: ZebraColumn<T>[];
  keyExtractor?: (item: T, index: number) => string | number;
  caption?: string;
  emptyText?: string;
  className?: string;
  /** Di bawah breakpoint lg (ponsel & tablet potret) baris ditampilkan sebagai kartu, tanpa scroll horizontal. */
  mobileCards?: boolean;
}

export function ZebraDataTable<T>({
  data,
  columns,
  keyExtractor,
  caption,
  emptyText = "Belum ada data tersedia.",
  className,
  mobileCards = false,
}: ZebraDataTableProps<T>) {
  const renderCell = (col: ZebraColumn<T>, item: T, rowIndex: number) =>
    col.cell
      ? col.cell(item, rowIndex)
      : col.accessorKey
      ? String(item[col.accessorKey] ?? "-")
      : null;

  const table = (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-lg border border-border bg-card shadow-xs",
        mobileCards && "hidden lg:block",
        className
      )}
    >
      <table className="w-full text-left text-sm border-collapse">
        {caption && (
          <caption className="py-2 px-4 text-xs text-muted-foreground text-left italic border-b border-border/50">
            {caption}
          </caption>
        )}
        <thead className="bg-muted/60 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border select-none">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                className={cn(
                  "py-3 px-4 font-semibold text-xs",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-10 px-4 text-center text-xs text-muted-foreground"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((item, rowIndex) => {
              const rowKey = keyExtractor
                ? keyExtractor(item, rowIndex)
                : rowIndex;
              return (
                <tr
                  key={rowKey}
                  className={cn(
                    "transition-colors hover:bg-muted/50",
                    rowIndex % 2 === 0
                      ? "bg-background"
                      : "bg-muted/25 dark:bg-muted/15"
                  )}
                >
                  {columns.map((col, colIndex) => {
                    const content = renderCell(col, item, rowIndex);

                    return (
                      <td
                        key={colIndex}
                        className={cn(
                          "py-3 px-4 text-xs text-foreground/90 align-middle",
                          col.isMono && "font-mono text-xs tracking-tight",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.className
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  if (!mobileCards) return table;

  return (
    <>
      <div className={cn("space-y-3 lg:hidden", className)}>
        {data.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-10 px-4 text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          data.map((item, rowIndex) => {
            const rowKey = keyExtractor ? keyExtractor(item, rowIndex) : rowIndex;
            const titles = columns.filter((c) => c.cardSlot === "title");
            const fields = columns.filter((c) => !c.cardSlot || c.cardSlot === "full");
            const footers = columns.filter((c) => c.cardSlot === "footer");
            return (
              <article key={rowKey} className="rounded-lg border border-border bg-card p-4 shadow-xs space-y-3">
                {titles.map((col, i) => (
                  <div key={i} className="text-sm text-foreground">
                    {renderCell(col, item, rowIndex)}
                  </div>
                ))}
                {fields.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {fields.map((col, i) => (
                      <div key={i} className={cn("min-w-0", col.cardSlot === "full" && "col-span-2")}>
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {col.header}
                        </dt>
                        <dd className={cn("mt-0.5 text-xs text-foreground/90 break-words", col.isMono && "font-mono tracking-tight")}>
                          {renderCell(col, item, rowIndex)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {footers.map((col, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
                    {renderCell(col, item, rowIndex)}
                  </div>
                ))}
              </article>
            );
          })
        )}
      </div>
      {table}
    </>
  );
}
