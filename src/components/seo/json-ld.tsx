import { SCHOOL, SITE_URL, absoluteUrl } from "@/lib/seo/site";
import type { FaqItem } from "@/lib/seo/faq";

type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

/** Menyisipkan structured data (schema.org) untuk Google. `<` di-escape agar aman dari injeksi script. */
export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function schoolSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["School", "EducationalOrganization"],
    "@id": `${SITE_URL}/#school`,
    name: SCHOOL.name,
    alternateName: SCHOOL.legalName,
    description: SCHOOL.description,
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    image: absoluteUrl("/opengraph-image"),
    email: SCHOOL.email,
    ...(SCHOOL.telephone ? { telephone: SCHOOL.telephone } : {}),
    identifier: { "@type": "PropertyValue", propertyID: "NPSN", value: SCHOOL.npsn },
    address: {
      "@type": "PostalAddress",
      streetAddress: SCHOOL.address.streetAddress,
      addressLocality: SCHOOL.address.addressLocality,
      addressRegion: SCHOOL.address.addressRegion,
      postalCode: SCHOOL.address.postalCode,
      addressCountry: SCHOOL.address.addressCountry,
    },
    geo: { "@type": "GeoCoordinates", ...SCHOOL.geo },
    hasMap: `https://www.google.com/maps?q=${SCHOOL.geo.latitude},${SCHOOL.geo.longitude}`,
    areaServed: [
      { "@type": "City", name: "Kota Depok" },
      { "@type": "AdministrativeArea", name: "Kecamatan Tapos" },
    ],
    ...(SCHOOL.sameAs.length ? { sameAs: SCHOOL.sameAs } : {}),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SCHOOL.name,
    url: SITE_URL,
    inLanguage: "id-ID",
    publisher: { "@id": `${SITE_URL}/#school` },
  };
}

export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}
