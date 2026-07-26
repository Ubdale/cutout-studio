import Link from "next/link";

const tools = [
  {
    href: "/remove-background",
    title: "Remove background",
    desc: "Turn any photo into a clean transparent PNG.",
    pill: "Live",
    live: true,
  },
  {
    href: "#",
    title: "Compress image",
    desc: "Shrink JPG, PNG and WebP without visible quality loss.",
    pill: "Soon",
    live: false,
  },
  {
    href: "#",
    title: "Convert format",
    desc: "PNG ⇄ JPG ⇄ WebP, right in your browser.",
    pill: "Soon",
    live: false,
  },
];

export default function Home() {
  return (
    <main>
      <header className="wrap topbar">
        <Link href="/" className="brand">
          <span className="brand-mark checker" />
          <span className="display brand-name">Cutout Studio</span>
        </Link>
        <span className="badge mono">100% in your browser</span>
      </header>

      <section className="wrap hub-hero">
        <p className="eyebrow mono">Free image tools</p>
        <h1 className="display">
          Fast image tools that
          <br />
          never upload your files.
        </h1>
        <p className="lead">
          Everything runs on your device. No sign-up, no watermark, no limits.
        </p>
      </section>

      <section className="wrap">
        <div className="tool-grid">
          {tools.map((t) =>
            t.live ? (
              <Link key={t.title} href={t.href} className="tool-card live">
                <span className="pill">{t.pill}</span>
                <h3 className="display">{t.title}</h3>
                <p>{t.desc}</p>
              </Link>
            ) : (
              <div key={t.title} className="tool-card soon">
                <span className="pill">{t.pill}</span>
                <h3 className="display">{t.title}</h3>
                <p>{t.desc}</p>
              </div>
            )
          )}
        </div>
      </section>

      <footer className="wrap foot">
        <span className="mono">Cutout Studio · runs on your device</span>
        <Link href="/remove-background">Remove a background</Link>
      </footer>
    </main>
  );
}
