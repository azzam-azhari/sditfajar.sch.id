"use client";

import * as React from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Menampilkan thumbnail + tombol play buatan sendiri; player YouTube baru dimuat
 * (dengan autoplay) setelah diklik. Branding YouTube tidak ditutupi saat video
 * berjalan — itu dilarang ketentuan YouTube — hanya ditunda sampai pengunjung memutar.
 */
export function YoutubeFacade({
  videoId,
  title,
  className,
}: {
  videoId: string;
  title: string;
  className?: string;
}) {
  const [playing, setPlaying] = React.useState(false);

  if (playing) {
    return (
      <iframe
        className={cn("absolute inset-0 size-full", className)}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Putar video: ${title}`}
      className={cn(
        "group absolute inset-0 size-full cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <Image
        src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
        alt=""
        fill
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
      <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110 group-focus-visible:scale-110">
          <Play className="size-7 translate-x-0.5 fill-current" aria-hidden />
        </span>
      </span>
    </button>
  );
}
