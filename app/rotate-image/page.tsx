import type { Metadata } from "next";
import Link from "next/link";
import RotateImage from "@/components/RotateImage";

export const metadata: Metadata = {
  title: "Rotate & flip image",
  description:
    "Rotate or flip images 90 degrees at a time for free. Runs entirely in your browser, nothing is uploaded.",
  alternates: { canonical: "/rotate-image" },
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
        <p className="eyebrow mono">Rotate & flip</p>
        <h1 className="display">Rotate or flip an image.<br />Right in your browser.</h1>
        <p className="lead">Turn the image left or right and mirror it horizontally or vertically, then download.</p>
      </section>
      <section className="wrap tool-slot">
        <RotateImage />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
