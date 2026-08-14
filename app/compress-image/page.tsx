import type { Metadata } from "next";
import Link from "next/link";
import ImageCompressor from "@/components/ImageCompressor";

export const metadata: Metadata = {
  title: "Compress Image Online — Fast, Free, No Server Upload",
  description:
    "Compress JPG, PNG or WebP images instantly in your browser — zero upload wait. Adjust quality and width, then export as JPG, PNG or WebP.",
  keywords: [
    "compress image online",
    "reduce image file size",
    "image compressor free",
    "shrink jpg png",
  ],
  alternates: { canonical: "/compress-image" },
};

export default function Page() {
  return (
    <main>
      <header className="wrap topbar">
        <Link href="/" className="brand">
          <span className="brand-mark checker" />
          <span className="display brand-name">Cutout Studio</span>
        </Link>
        <span className="badge mono">100% in your browser</span>
      </header>
      <section className="wrap hero">
        <p className="eyebrow mono">Image compressor</p>
        <h1 className="display">Compress images for free.<br />Nothing leaves your device.</h1>
        <p className="lead">Shrink JPG, PNG and WebP with a live quality preview, then download. No sign-up, no upload.</p>
      </section>
      <section className="wrap tool-slot">
        <ImageCompressor />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
