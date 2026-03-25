"use client";

import { AuthGuard } from "@/components/auth-guard";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { parseApiError } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const CabinetPageContent = () => {
  const router = useRouter();
  const { user, authenticatedFetch, refreshSession } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const avatarPreviewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile],
  );

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: async () => {
      await refreshSession();
      setSuccess("Profil ma'lumotlari yangilandi.");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Profilni yangilab bo'lmadi");
      setSuccess(null);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!avatarFile) {
        throw new Error("Rasm tanlang");
      }

      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await authenticatedFetch("/auth/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: async () => {
      await refreshSession();
      setAvatarFile(null);
      setSuccess("Profil rasmi yuklandi.");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Rasmni yuklab bo'lmadi");
      setSuccess(null);
    },
  });

  const onProfileSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("Ism bo'sh bo'lmasligi kerak");
      return;
    }

    updateProfileMutation.mutate();
  };

  const onAvatarSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    uploadAvatarMutation.mutate();
  };

  const profileUser = {
    name: user?.name ?? "Foydalanuvchi",
    avatarUrl: avatarPreviewUrl ?? user?.avatarUrl ?? null,
  };

  return (
    <main className="page-wrap">
      <div className="topbar cabinet-topbar">
        <div>
          <p className="workspace-eyebrow">Kabinet</p>
          <h1 className="workspace-title">Profil sozlamalari</h1>
          <p className="workspace-subtitle">Shaxsiy ma&apos;lumot va rasmni yangilang.</p>
        </div>
        <button className="button secondary" onClick={() => router.push("/dashboard")} type="button">
          <ArrowLeft size={16} /> Bosh sahifa
        </button>
      </div>

      <section className="glass-card cabinet-layout frame-reveal">
        <aside className="cabinet-profile-pane">
          <UserAvatar size="lg" user={profileUser} />
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
        </aside>

        <div className="cabinet-form-pane">
          <form className="form-grid" onSubmit={onProfileSubmit}>
            <h3>Asosiy ma&apos;lumot</h3>
            <label className="field-label" htmlFor="name">
              Ism
            </label>
            <input
              className="input"
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="button" disabled={updateProfileMutation.isPending} type="submit">
              {updateProfileMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </form>

          <form className="form-grid cabinet-avatar-form" onSubmit={onAvatarSubmit}>
            <h3>Profil rasmi</h3>
            <label className="field-label" htmlFor="avatar">
              Rasm fayli (JPG, PNG, WEBP, maksimal 3MB)
            </label>
            <input
              accept="image/*"
              className="input"
              id="avatar"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setAvatarFile(file);
              }}
            />
            <button className="button secondary" disabled={uploadAvatarMutation.isPending || !avatarFile} type="submit">
              <Upload size={16} />
              {uploadAvatarMutation.isPending ? "Yuklanmoqda..." : "Rasm yuklash"}
            </button>
          </form>

          {error ? <p className="error-text">{error}</p> : null}
          {success ? <p className="success-text">{success}</p> : null}
        </div>
      </section>
    </main>
  );
};

export default function CabinetPage() {
  return (
    <AuthGuard>
      <CabinetPageContent />
    </AuthGuard>
  );
}
