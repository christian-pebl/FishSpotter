import { SITE_URL } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/account",
          "/admin",
          // Parent links carry one-time tokens.
          "/parent/consent/",
          "/parent/manage/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
