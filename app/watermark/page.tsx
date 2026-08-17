import type { Metadata } from "next";
import Link from "next/link";
import Watermark from "@/components/Watermark";

export const metadata: Metadata = {
  title: "Add Watermark to Image Online Free — No Upload",
  description:
    "Stamp a text watermark onto your photos instantly in your browser — single or tiled, custom size/color/opacity. No upload, no signup, single or bulk.",
  keywords: [
    "add watermark to photo online",
    "free watermark maker",
    "watermark image online",
    "bulk watermark images",
  ],
  alternates: { canonical: "/watermark" },
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
        <p className="eyebrow mono">Watermark</p>
        <h1 className="display">Stamp your photos.<br />Nothing leaves your device.</h1>
        <p className="lead">
          Add a text watermark — single mark or repeating tile — with full control over
          size, color, opacity and position. Single image or bulk.
        </p>
      </section>
      <section className="wrap tool-slot">
        <Watermark />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
