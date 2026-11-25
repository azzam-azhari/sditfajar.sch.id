import type { NextConfig } from "next";

/** Header keamanan untuk semua route (Fase 8). CSP penuh belum dipasang karena butuh audit script pihak ketiga. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Build verifikasi lokal bisa diarahkan ke folder lain agar tidak menimpa .next milik `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // URL lama SPMB dipindah ke /spmb; tautan lama & hasil mesin pencari tetap diarahkan.
  async redirects() {
    return [
      { source: "/pendaftaran", destination: "/spmb", permanent: true },
      { source: "/pendaftaran/:path*", destination: "/spmb/:path*", permanent: true },
      { source: "/dashboard/admin/pendaftaran", destination: "/dashboard/admin/spmb", permanent: true },
    ];
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Foto sementara dari Unsplash (halaman publik). Hanya host ini yang diizinkan.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Thumbnail video YouTube untuk YoutubeFacade.
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
