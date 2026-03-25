import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <section className="glass-card landing-card frame-reveal">
        <span className="landing-label">Realtime Product Workspace</span>
        <h1 className="landing-title">Collaborative Notes Workspace</h1>
        <p className="landing-copy">
          Real-time writing, team comments, presence, and version history in one focused workspace.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/auth/login">
            Sign in
          </Link>
          <Link className="button secondary" href="/auth/register">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
