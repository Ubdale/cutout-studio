import type { Metadata } from "next";
import Link from "next/link";
import FileConverter from "@/components/FileConverter";

export const metadata: Metadata = {
  title: "Convert Excel, CSV & JSON Online Free — No Upload",
  description:
    "Convert between Excel (.xlsx), CSV and JSON instantly in your browser — no upload, no signup. Accurate spreadsheet conversion, single file or bulk.",
  keywords: [
    "convert excel to csv",
    "csv to json converter",
    "json to excel",
    "xlsx converter online free",
    "spreadsheet converter",
  ],
  alternates: { canonical: "/convert-file" },
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
        <p className="eyebrow mono">File converter</p>
        <h1 className="display">Convert Excel, CSV and JSON.<br />Nothing leaves your device.</h1>
        <p className="lead">
          Accurate spreadsheet conversion powered by SheetJS — the same engine real
          companies use. Single file or bulk. No sign-up, no upload.
        </p>
      </section>
      <section className="wrap tool-slot">
        <FileConverter />
      </section>
      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>
    </main>
  );
}
