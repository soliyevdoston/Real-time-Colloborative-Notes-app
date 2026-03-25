"use client";

import { useAuth } from "@/contexts/auth-context";
import { getErrorMessage } from "@/lib/error-message";
import { normalizeNextPath } from "@/lib/routing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    setNextPath(normalizeNextPath(next));
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register({ name: name.trim(), email: email.trim(), password });
      const redirectPath = nextPath ?? "/dashboard";
      router.replace(redirectPath);
    } catch (err) {
      setError(getErrorMessage(err, "Akkaunt yaratib bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-wrap">
      <section className="glass-card auth-layout frame-reveal">
        <aside className="auth-aside">
          <div>
            <h2>Jamoaviy hujjat ish maydoningizni yarating.</h2>
            <p>Hamkorlarni taklif qiling, onlayn foydalanuvchilarni ko&apos;ring va o&apos;zgarishlarni bir zumda sinxron qiling.</p>
          </div>
          <p className="auth-note">
            Tezkor jamoaviy yozish, aniq rollar va toza versiya snapshotlari uchun yaratilgan.
          </p>
        </aside>
        <div className="auth-card">
          <h1 className="auth-title">Ish maydonini yarating</h1>
          <p className="auth-subtitle">Jamoangiz bilan hujjat yozishni bir necha soniyada boshlang.</p>
          <form className="form-grid" onSubmit={onSubmit}>
            <input
              className="input"
              type="text"
              placeholder="To&apos;liq ism"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
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
              placeholder="Parol (kamida 8 ta belgi)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? <p className="error-text">{error}</p> : null}
            <button className="button" disabled={loading} type="submit">
              {loading ? "Yaratilmoqda..." : "Akkaunt yaratish"}
            </button>
          </form>
          <p style={{ marginTop: 16, color: "var(--text-secondary)" }}>
            Akkauntingiz bormi?{" "}
            <Link
              className="inline-link"
              href={
                nextPath
                  ? "/auth/login?next=" + encodeURIComponent(nextPath)
                  : "/auth/login"
              }
            >
              Kirish
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
