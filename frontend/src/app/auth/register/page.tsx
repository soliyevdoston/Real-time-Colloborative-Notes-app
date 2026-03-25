"use client";

import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register({ name, email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-wrap">
      <section className="glass-card auth-layout frame-reveal">
        <aside className="auth-aside">
          <div>
            <h2>Build your shared note workspace.</h2>
            <p>Invite collaborators, see who is online, and keep edits synchronized instantly.</p>
          </div>
          <p className="auth-note">
            Designed for fast team drafting with clear ownership and clean version snapshots.
          </p>
        </aside>
        <div className="auth-card">
          <h1 className="auth-title">Create your workspace</h1>
          <p className="auth-subtitle">Start writing notes with your team in seconds.</p>
          <form className="form-grid" onSubmit={onSubmit}>
            <input
              className="input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? <p className="error-text">{error}</p> : null}
            <button className="button" disabled={loading} type="submit">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p style={{ marginTop: 16, color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link className="inline-link" href="/auth/login">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
