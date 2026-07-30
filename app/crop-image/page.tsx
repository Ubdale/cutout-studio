import type { Metadata } from "next";
import Link from "next/link";
import CropImage from "@/components/CropImage";

export const metadata: Metadata = {
  title: "Crop image — drag to any size or ratio",
  description:
    "Crop images to any size or aspect ratio for free. Drag the box right in your browser — nothing is uploaded.",
  alternates: { canonical: "/crop-image" },
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
        <p className="eyebrow mono">Image cropper</p>
        <h1 className="display">Crop an image.<br />Right in your browser.</h1>
        <p className="lead">Drag the crop box or snap to 1:1, 4:3 and 16:9. Works on touch too.</p>
      </section>
      <section className="wrap tool-slot">
        <CropImage />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
