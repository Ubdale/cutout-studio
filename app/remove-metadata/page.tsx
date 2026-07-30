import type { Metadata } from "next";
import Link from "next/link";
import MetadataRemover from "@/components/MetadataRemover";

export const metadata: Metadata = {
  title: "Remove image metadata (EXIF, GPS)",
  description:
    "Strip EXIF, GPS and camera data from photos for free. The image never leaves your device — metadata is removed in your browser.",
  alternates: { canonical: "/remove-metadata" },
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
        <p className="eyebrow mono">Metadata remover</p>
        <h1 className="display">Remove hidden data<br />from your photos.</h1>
        <p className="lead">Photos carry location, camera and timestamp data. Strip it all before you share — privately, on your device.</p>
      </section>
      <section className="wrap tool-slot">
        <MetadataRemover />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
