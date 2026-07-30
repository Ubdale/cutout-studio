import type { Metadata } from "next";
import Link from "next/link";
import CircleCrop from "@/components/CircleCrop";

export const metadata: Metadata = {
  title: "Circle crop — round profile picture",
  description:
    "Crop a photo into a circle and export a transparent PNG for free. Runs in your browser, nothing is uploaded.",
  alternates: { canonical: "/circle-crop" },
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
        <p className="eyebrow mono">Circle crop</p>
        <h1 className="display">Make a round<br />profile picture.</h1>
        <p className="lead">Crop any photo to a clean circle on a transparent PNG, with an optional white ring. Ready for any avatar.</p>
      </section>
      <section className="wrap tool-slot">
        <CircleCrop />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
