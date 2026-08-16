import type { MetadataRoute } from "next";

const BASE = "https://cutout.studio";

const TOOLS = [
  "remove-background",
  "compress-image",
  "convert-image",
  "resize-image",
  "crop-image",
  "circle-crop",
  "rotate-image",
  "remove-metadata",
  "convert-file",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...TOOLS.map((slug) => ({
      url: `${BASE}/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
