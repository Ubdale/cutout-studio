import type { Metadata } from "next";
import Link from "next/link";
import ImageCompressor from "@/components/ImageCompressor";

export const metadata: Metadata = {
  title: "Compress image — free & private",
  description:
    "Compress JPG, PNG and WebP images for free. Runs entirely in your browser, nothing is uploaded. Adjust quality and size, then download.",
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
