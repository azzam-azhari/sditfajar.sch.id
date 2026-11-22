"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV_LINKS, type NavLinkItem } from "@/constants/navigation";

interface PublicNavDesktopProps {
  className?: string;
  links?: NavLinkItem[];
}

export function PublicNavDesktop({
  className,
  links = PUBLIC_NAV_LINKS,
}: PublicNavDesktopProps) {
  const pathname = usePathname();

  const isLinkActive = React.useCallback(
    (href: string) => {
      if (href === "/") {
        return pathname === "/";
      }
      return pathname === href;
    },
    [pathname]
  );

  return (
    <nav
      aria-label="Navigasi Desktop"
      className={cn("hidden lg:flex items-center gap-1 xl:gap-1.5", className)}
    >
      {links.map((item) => {
        if (item.children && item.children.length > 0) {
          const isDropdownActive =
            isLinkActive(item.href) ||
            item.children.some((child) => isLinkActive(child.href));

          return (
            <DropdownMenu key={item.href}>
              <DropdownMenuTrigger
                className={cn(
                  "group inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs xl:text-sm font-medium transition-colors outline-none",
                  "hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  isDropdownActive
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground"
                )}
              >
                <span>{item.label}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="w-80 p-1.5 rounded-xl border border-border/80 bg-popover shadow-lg"
              >
                {item.children.map((child) => {
                  const isChildActive = isLinkActive(child.href);
                  const Icon = child.icon;
                  return (
                    <DropdownMenuItem
                      key={child.href}
                      asChild
                      className={cn(
                        "group/sub cursor-pointer items-start p-0 focus:bg-muted/70",
                        isChildActive && "bg-primary/5"
                      )}
                    >
                      <Link
                        href={child.href}
                        aria-current={isChildActive ? "page" : undefined}
                        className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors"
                      >
                        {Icon && (
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                              isChildActive
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border/70 bg-muted/50 text-muted-foreground group-focus/sub:text-primary group-hover/sub:text-primary"
                            )}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                        )}
                        <span className="flex min-w-0 flex-col gap-1">
                          <span
                            className={cn(
                              "text-sm leading-tight",
                              isChildActive ? "font-semibold text-primary" : "font-medium text-foreground"
                            )}
                          >
                            {child.label}
                          </span>
                          {child.desc && (
                            <span className="text-xs leading-snug text-muted-foreground">
                              {child.desc}
                            </span>
                          )}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        const active = isLinkActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center rounded-md px-2.5 py-1.5 text-xs xl:text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
