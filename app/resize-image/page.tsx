import type { Metadata } from "next";
import Link from "next/link";
import ResizeImage from "@/components/ResizeImage";

export const metadata: Metadata = {
  title: "Resize image — set width & height",
  description:
    "Resize any image to exact pixels or scale by percent, free. Runs entirely in your browser, nothing is uploaded.",
  alternates: { canonical: "/resize-image" },
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
        <p className="eyebrow mono">Image resizer</p>
        <h1 className="display">Resize an image.<br />Right in your browser.</h1>
        <p className="lead">Set exact width and height, keep the aspect ratio, and download. No upload, no limits.</p>
      </section>
      <section className="wrap tool-slot">
        <ResizeImage />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
