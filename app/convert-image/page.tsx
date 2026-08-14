import type { Metadata } from "next";
import Link from "next/link";
import ImageConverter from "@/components/ImageConverter";

export const metadata: Metadata = {
  title: "Convert Image Format Online Free — JPG, PNG, WebP",
  description:
    "Convert images between JPG, PNG and WebP instantly in your browser — no upload, no signup. Fast, private, unlimited, one click to download.",
  keywords: [
    "convert image format",
    "png to jpg converter",
    "jpg to webp online",
    "image format converter free",
  ],
  alternates: { canonical: "/convert-image" },
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
        <p className="eyebrow mono">Image converter</p>
        <h1 className="display">Convert PNG, JPG & WebP.<br />Right in your browser.</h1>
        <p className="lead">Switch image formats instantly with no upload. Pick a format and download.</p>
      </section>
      <section className="wrap tool-slot">
        <ImageConverter />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
