import type { Metadata } from "next";
import Link from "next/link";
import BackgroundRemover from "@/components/BackgroundRemover";

export const metadata: Metadata = {
  title: "Remove Background from Image Instantly — Free, No Upload",
  description:
    "Remove image backgrounds in seconds, right in your browser — no server upload, no signup, no watermark. Download as PNG, JPG or WebP.",
  keywords: [
    "remove background from image",
    "background remover online",
    "transparent background maker",
    "remove bg free",
  ],
  alternates: { canonical: "/remove-background" },
};

const steps = [
  {
    n: "01",
    t: "Drop your image",
    d: "Pick a JPG, PNG or WebP, or drag it straight onto the page.",
  },
  {
    n: "02",
    t: "It runs on your device",
    d: "The cutout is computed in your browser. The file never touches a server.",
  },
  {
    n: "03",
    t: "Download the PNG",
    d: "Grab a transparent PNG, ready to drop onto any background.",
  },
];

const faqs = [
  {
    q: "Is it really free?",
    a: "Yes. No account, no watermark, no per-image limit. The work happens on your own device, so there is nothing to meter.",
  },
  {
    q: "Do you upload my images?",
    a: "No. The image is processed in your browser. It is never sent to a server, which is why it also works offline once the page has loaded.",
  },
  {
    q: "Why is the first image slow?",
    a: "The first run downloads the model to your browser once. After that, every image is fast because the model is cached.",
  },
  {
    q: "What formats can I use?",
    a: "JPG, PNG and WebP go in; a transparent PNG comes out.",
  },
];

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
        <p className="eyebrow mono">Background remover</p>
        <h1 className="display">
          Remove any background.
          <br />
          Free, and it never leaves your device.
        </h1>
        <p className="lead">
          Drop an image and get a clean transparent PNG in seconds. No sign-up,
          no watermark, no upload.
        </p>
      </section>

      <section className="wrap tool-slot">
        <BackgroundRemover />
      </section>

      <section className="wrap steps">
        <h2 className="display section-title">How it works</h2>
        <ol className="step-grid">
          {steps.map((s) => (
            <li key={s.n} className="step">
              <span className="step-n mono">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap faq">
        <h2 className="display section-title">Questions</h2>
        <div className="faq-list">
          {faqs.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/">More tools</Link>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </main>
  );
}
