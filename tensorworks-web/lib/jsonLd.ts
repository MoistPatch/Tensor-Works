import { siteSEO } from "@/content/seo";

type JsonLdObject = Record<string, unknown>;

const baseUrl = siteSEO.siteUrl;

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteSEO.siteName,
    url: baseUrl,
    description: siteSEO.defaultDescription,
    inLanguage: "en-AU",
  };
}

export function productJsonLd(params: {
  name: string;
  description: string;
  category: string;
  path: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: params.name,
    description: params.description,
    category: params.category,
    url: `${baseUrl}${params.path}`,
    brand: {
      "@type": "Brand",
      name: "TensorWorks",
    },
    manufacturer: {
      "@type": "Organization",
      name: "TensorWorks Pty Ltd",
    },
  };
}

export function articleJsonLd(params: {
  title: string;
  description: string;
  slug: string;
  publishedAt: Date | null;
  updatedAt: Date | null;
  author: string;
  coverImageUrl?: string | null;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.title,
    description: params.description,
    url: `${baseUrl}/insights/${params.slug}`,
    datePublished: params.publishedAt?.toISOString(),
    dateModified: (params.updatedAt ?? params.publishedAt)?.toISOString(),
    author: {
      "@type": "Organization",
      name: params.author,
    },
    publisher: {
      "@type": "Organization",
      name: "TensorWorks",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/og-default.png`,
      },
    },
    image: params.coverImageUrl ? [params.coverImageUrl] : [`${baseUrl}/og-default.png`],
    inLanguage: "en-AU",
  };
}

export function contactPageJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact TensorWorks",
    url: `${baseUrl}/contact`,
    description:
      "Request a quote for AI compute infrastructure. We respond with a scoped proposal within two business days.",
  };
}

export function jsonLdScript(data: JsonLdObject) {
  return {
    __html: JSON.stringify(data),
  };
}
