import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Bukti pendaftaran berisi data pribadi calon murid — jangan diindeks.
      disallow: ["/dashboard/", "/api/", "/login", "/ganti-password", "/pendaftaran/sukses/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
