import type { Metadata } from "next";
import { Space_Grotesk, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cutout.studio"),
  title: {
    default: "Cutout Studio — free, instant image tools in your browser",
    template: "%s · Cutout Studio",
  },
  description:
    "Remove backgrounds, compress, convert, resize and crop images instantly — no upload, no wait, no signup. Runs entirely in your browser, export to PNG, JPG or WebP.",
  keywords: [
    "remove background online",
    "compress image online",
    "convert image format",
    "resize image online",
    "free image tools",
    "no upload image editor",
  ],
  openGraph: {
    type: "website",
    siteName: "Cutout Studio",
    title: "Cutout Studio — free, instant image tools in your browser",
    description:
      "Remove backgrounds, compress, convert, resize and crop images instantly — no upload, no wait, no signup.",
    url: "https://cutout.studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cutout Studio — free, instant image tools in your browser",
    description:
      "Remove backgrounds, compress, convert, resize and crop images instantly — no upload, no wait, no signup.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Warms the connection to the background-removal model CDN
            before the user even opens that tool, so the one-time
            model download starts faster instead of paying DNS/TLS
            setup cost on top of the fetch. */}
        <link rel="preconnect" href="https://staticimgly.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://staticimgly.com" />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
