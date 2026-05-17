import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();

  return [
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 1,
      url: baseUrl
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.9,
      url: `${baseUrl}/pricing`
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${baseUrl}/login`
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${baseUrl}/register`
    }
  ];
}
