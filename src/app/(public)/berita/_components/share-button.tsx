"use client";

import * as React from "react";
import { Share2, Check, Copy, MessageCircle, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ShareButtonProps {
  title?: string;
  url?: string;
}

type Target = {
  name: string;
  className: string;
  icon: React.ReactNode;
  href: (url: string, text: string) => string;
};

const Glyph = ({ children }: { children: string }) => (
  <span className="text-sm font-bold leading-none">{children}</span>
);

const TARGETS: Target[] = [
  {
    name: "WhatsApp",
    className: "bg-[#25D366] text-white",
    icon: <MessageCircle className="size-5" />,
    href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
  },
  {
    name: "Facebook",
    className: "bg-[#1877F2] text-white",
    icon: <Glyph>f</Glyph>,
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    name: "X",
    className: "bg-black text-white dark:bg-white dark:text-black",
    icon: <Glyph>𝕏</Glyph>,
    href: (u, t) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    name: "Telegram",
    className: "bg-[#229ED9] text-white",
    icon: <Send className="size-5" />,
    href: (u, t) =>
      `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    name: "LinkedIn",
    className: "bg-[#0A66C2] text-white",
    icon: <Glyph>in</Glyph>,
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
  },
  {
    name: "Email",
    className: "bg-muted text-foreground",
    icon: <Mail className="size-5" />,
    href: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}`,
  },
];

export function ShareButton({ title, url }: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [targetUrl, setTargetUrl] = React.useState(url ?? "");
  const text = title ?? "Berita SDIT Fajar";

  React.useEffect(() => {
    if (!url) setTargetUrl(window.location.href);
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      toast.success("Tautan artikel berhasil disalin!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin tautan.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bagikan Berita</DialogTitle>
          <DialogDescription className="line-clamp-2">{text}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          {TARGETS.map((t) => (
            <a
              key={t.name}
              href={t.href(targetUrl, text)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${t.className}`}
              >
                {t.icon}
              </span>
              <span className="text-xs text-foreground">{t.name}</span>
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-1.5 pl-3">
          <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
            {targetUrl}
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={handleCopy} className="shrink-0 gap-1.5 text-xs">
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
