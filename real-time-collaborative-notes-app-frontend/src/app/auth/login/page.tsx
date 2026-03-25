"use client";

import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/")) {
      setNextPath(next);
    }
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      const redirectPath = nextPath ?? "/dashboard";
      router.replace(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tizimga kirib bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-wrap">
      <section className="glass-card auth-layout frame-reveal">
        <aside className="auth-aside">
          <div>
            <h2>Birga yozing, uzilishsiz ishlang.</h2>
            <p>Note oching, hamkorlarni taklif qiling va bitta maydonda real-time ishlang.</p>
          </div>
          <p className="auth-note">
            Xavfsiz JWT autentifikatsiya, real-time sinxron, kommentlar va ixcham versiya tarixi.
          </p>
        </aside>
        <div className="auth-card">
          <h1 className="auth-title">Qaytganingizdan xursandmiz</h1>
          <p className="auth-subtitle">Jamoa bilan ishlashni davom ettirish uchun tizimga kiring.</p>
          <form className="form-grid" onSubmit={onSubmit}>
            <input
              className="input"
              type="email"
              placeholder="Elektron pochta"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Parol"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? <p className="error-text">{error}</p> : null}
            <button className="button" disabled={loading} type="submit">
              {loading ? "Kirilmoqda..." : "Kirish"}
            </button>
          </form>
          <p style={{ marginTop: 16, color: "var(--text-secondary)" }}>
            Akkauntingiz yo&apos;qmi?{" "}
            <Link
              className="inline-link"
              href={
                nextPath
                  ? "/auth/register?next=" + encodeURIComponent(nextPath)
                  : "/auth/register"
              }
            >
              Ro&apos;yxatdan o&apos;tish
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
