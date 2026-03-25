"use client";

import { AuthGuard } from "@/components/auth-guard";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { parseApiError } from "@/lib/api";
import { NoteSummary } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";
import { CircleUserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const DashboardContent = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authenticatedFetch, logout, user } = useAuth();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const notesQuery = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const response = await authenticatedFetch("/notes");
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as { notes: NoteSummary[] };
      return data.notes;
    },
  });

  const createNote = useMutation({
    mutationFn: async (nextTitle: string) => {
      const response = await authenticatedFetch("/notes", {
        method: "POST",
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      return (await response.json()) as { note: NoteSummary };
    },
    onSuccess: ({ note }) => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      router.push("/notes/" + note.id);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Hujjat yaratishda xatolik yuz berdi");
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await authenticatedFetch("/notes/" + noteId, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Hujjatni o'chirishda xatolik yuz berdi");
    },
  });

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Sarlavha kiritilishi shart");
      return;
    }

    createNote.mutate(title.trim());
  };

  return (
    <main className="page-wrap">
      <div className="topbar">
        <div>
          <p className="workspace-eyebrow">Ish maydoni</p>
          <h1 className="workspace-title">Salom, {user?.name}</h1>
          <p className="workspace-subtitle">Jamoaviy hujjatlaringizni boshqaring va oching.</p>
        </div>
        <div className="topbar-actions">
          {user ? (
            <button className="button secondary profile-chip" onClick={() => router.push("/cabinet")} type="button">
              <UserAvatar size="sm" user={user} />
              <CircleUserRound size={16} />
              Kabinet
            </button>
          ) : null}
          <button
            className="button secondary"
            onClick={() => {
              void logout();
              router.replace("/auth/login");
            }}
            type="button"
          >
            Chiqish
          </button>
        </div>
      </div>

      <form className="glass-card dashboard-create frame-reveal" onSubmit={handleCreate}>
        <div className="dashboard-create-row">
          <input
            className="input"
            placeholder="Yangi hujjat sarlavhasi"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="button" disabled={createNote.isPending} type="submit">
            {createNote.isPending ? "Yaratilmoqda..." : "Hujjat yaratish"}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </form>

      {notesQuery.isLoading ? <p>Hujjatlar yuklanmoqda...</p> : null}
      {notesQuery.error ? <p className="error-text">{(notesQuery.error as Error).message}</p> : null}

      <section className="dashboard-grid">
        {(notesQuery.data ?? []).map((note) => (
          <article className="note-card frame-reveal" key={note.id}>
            <div>
              <h3 className="note-title">{note.title}</h3>
              <p className="note-meta">
                Yangilangan vaqt: {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: uz })}
              </p>
            </div>
            <div className="pill-list">
              <span className="pill">{note.members.length} hamkor</span>
              <span className="pill">{note._count.comments} komment</span>
              <span className="pill">{note._count.versions} versiya</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button" onClick={() => router.push("/notes/" + note.id)} type="button">
                Ochish
              </button>
              <button
                className="button danger"
                onClick={() => deleteNote.mutate(note.id)}
                type="button"
              >
                O&apos;chirish
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
};

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
