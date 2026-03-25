import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <section className="glass-card landing-card frame-reveal">
        <span className="landing-label">Real-time Jamoaviy Maydon</span>
        <h1 className="landing-title">Jamoaviy Note Ish Maydoni</h1>
        <p className="landing-copy">
          Real-time yozish, jamoa kommentlari, online holat va versiya tarixi yagona ish maydonida.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/auth/login">
            Kirish
          </Link>
          <Link className="button secondary" href="/auth/register">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </div>
      </section>
    </main>
  );
}
