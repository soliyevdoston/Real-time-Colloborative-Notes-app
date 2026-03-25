"use client";

import { AuthGuard } from "@/components/auth-guard";
import { CollaborativeEditor } from "@/components/editor/collab-editor";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { parseApiError } from "@/lib/api";
import { colorFromId } from "@/lib/presence-color";
import {
  CollaboratorChangedEvent,
  CollaboratorSuggestion,
  CommentItem,
  NoteSummary,
  NoteVersion,
  PresenceUser,
} from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CircleUserRound, History, MessageSquareText, UserPlus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

type PresenceUpdateEvent = {
  noteId: string;
  users: PresenceUser[];
};

type NoteResponse = {
  note: NoteSummary;
};

const NotePageContent = () => {
  const params = useParams<{ id: string }>();
  const noteId = useMemo(() => String(params.id), [params.id]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authenticatedFetch, accessToken, user, logout } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [titleDraftState, setTitleDraftState] = useState<{ noteId: string; value: string | null }>({
    noteId,
    value: null,
  });
  const [commentBody, setCommentBody] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteInputFocused, setInviteInputFocused] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"collaborators" | "comments" | "history">("comments");

  const socketRef = useRef<Socket | null>(null);
  const lastCursorSentRef = useRef(0);
  const inviteEmailTrimmed = inviteEmail.trim();

  const noteQuery = useQuery({
    queryKey: ["note", noteId],
    queryFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId);
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      return (await response.json()) as NoteResponse;
    },
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", noteId],
    queryFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId + "/comments");
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as { comments: CommentItem[] };
      return data.comments;
    },
  });

  const versionsQuery = useQuery({
    queryKey: ["versions", noteId],
    queryFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId + "/versions");
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as { versions: NoteVersion[] };
      return data.versions;
    },
  });

  const collaboratorSuggestionsQuery = useQuery({
    queryKey: ["collaborator-suggestions", noteId, inviteEmailTrimmed],
    queryFn: async () => {
      const response = await authenticatedFetch(
        "/notes/" +
          noteId +
          "/collaborators/suggestions?query=" +
          encodeURIComponent(inviteEmailTrimmed),
      );
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as { users: CollaboratorSuggestion[] };
      return data.users;
    },
    enabled:
      Boolean(noteQuery.data?.note.owner.id === user?.id) && inviteEmailTrimmed.length >= 2,
    staleTime: 5000,
  });

  const titleDraft = titleDraftState.noteId === noteId ? titleDraftState.value : null;

  useEffect(() => {
    const note = noteQuery.data?.note;
    const nextTitle = (titleDraft ?? note?.title ?? "").trim();

    if (!note || titleDraft === null || !nextTitle || nextTitle === note.title) {
      return;
    }

    const timeout = setTimeout(async () => {
      const response = await authenticatedFetch("/notes/" + noteId, {
        method: "PATCH",
        body: JSON.stringify({ title: nextTitle }),
      });

      if (response.ok) {
        setTitleDraftState({ noteId, value: null });
        void queryClient.invalidateQueries({ queryKey: ["notes"] });
        void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, [authenticatedFetch, noteId, noteQuery.data?.note, queryClient, titleDraft]);

  useEffect(() => {
    if (!accessToken || !user) {
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
      },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("presence:join", {
        noteId,
        color: colorFromId(user.id),
      });
    });

    socket.on("presence:update", (event: PresenceUpdateEvent) => {
      if (event.noteId === noteId) {
        setOnlineUsers(event.users);
      }
    });

    socket.on("comment:created", (event: { noteId: string; comment: CommentItem }) => {
      if (event.noteId !== noteId) {
        return;
      }

      queryClient.setQueryData<CommentItem[]>(["comments", noteId], (old = []) => {
        return [...old, event.comment];
      });
    });

    socket.on("comment:resolved", (event: { noteId: string; comment: CommentItem }) => {
      if (event.noteId !== noteId) {
        return;
      }

      queryClient.setQueryData<CommentItem[]>(["comments", noteId], (old = []) => {
        return old.map((item) => (item.id === event.comment.id ? event.comment : item));
      });
    });

    socket.on("version:created", (event: { noteId: string }) => {
      if (event.noteId === noteId) {
        void queryClient.invalidateQueries({ queryKey: ["versions", noteId] });
      }
    });

    socket.on("collaborator:changed", (event: CollaboratorChangedEvent) => {
      if (event.noteId !== noteId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });

      if (event.targetUserId === user.id && event.action === "added") {
        setPanelError("Siz bu note'ga collaborator sifatida qo'shildingiz.");
      }

      if (event.targetUserId === user.id && event.action === "removed") {
        setPanelError("Siz ushbu note'dan olib tashlandingiz.");
      }
    });

    socket.on("collaboration:access-removed", (event: { noteId: string }) => {
      if (event.noteId !== noteId) {
        return;
      }

      setPanelError("Sizning ushbu note uchun ruxsatingiz bekor qilindi.");
      router.replace("/dashboard");
    });

    return () => {
      socket.emit("presence:leave", { noteId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, noteId, queryClient, router, user]);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId + "/collaborators", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      return (await response.json()) as NoteResponse;
    },
    onSuccess: () => {
      setInviteEmail("");
      setPanelError("Collaborator muvaffaqiyatli qo'shildi.");
      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    },
    onError: (err) => {
      setPanelError(err instanceof Error ? err.message : "Failed to invite collaborator");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await authenticatedFetch("/notes/" + noteId + "/collaborators/" + userId, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: () => {
      setPanelError("Collaborator note'dan olib tashlandi.");
      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    },
    onError: (err) => {
      setPanelError(err instanceof Error ? err.message : "Failed to remove collaborator");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await authenticatedFetch(
        "/notes/" + noteId + "/versions/" + versionId + "/restore",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: () => {
      window.location.reload();
    },
    onError: (err) => {
      setPanelError(err instanceof Error ? err.message : "Failed to restore version");
    },
  });

  const note = noteQuery.data?.note;
  const versions = versionsQuery.data ?? [];

  const onSubmitComment = (event: FormEvent) => {
    event.preventDefault();
    if (!commentBody.trim()) {
      return;
    }

    socketRef.current?.emit("comment:create", {
      noteId,
      body: commentBody.trim(),
    });
    setCommentBody("");
  };

  const onCursorChange = (from: number, to: number) => {
    const now = Date.now();
    if (now - lastCursorSentRef.current < 120) {
      return;
    }

    lastCursorSentRef.current = now;
    socketRef.current?.emit("presence:cursor", {
      noteId,
      from,
      to,
    });
  };

  const ownerId = note?.owner.id;
  const canManageCollaborators = ownerId === user?.id;

  return (
    <main className="page-wrap">
      <div className="topbar">
        <div>
          <p className="workspace-eyebrow">Jamoaviy note</p>
          <h1 className="workspace-title">{note?.title ?? "Loading..."}</h1>
          <p className="workspace-subtitle">Real-time tahrirlash, kommentlar va versiya tarixi.</p>
        </div>
        <div className="topbar-actions">
          <button
            className={"button secondary toggle-button" + (activePanel === "collaborators" ? " active" : "")}
            onClick={() => setActivePanel("collaborators")}
            type="button"
          >
            <UserPlus size={16} /> Hamkorlar
          </button>
          <button
            className={"button secondary toggle-button" + (activePanel === "comments" ? " active" : "")}
            onClick={() => setActivePanel("comments")}
            type="button"
          >
            <MessageSquareText size={16} /> Kommentlar
          </button>
          <button
            className={"button secondary toggle-button" + (activePanel === "history" ? " active" : "")}
            onClick={() => setActivePanel("history")}
            type="button"
          >
            <History size={16} /> Tarix
          </button>
          <button className="button secondary" onClick={() => router.push("/dashboard")} type="button">
            <ArrowLeft size={16} /> Dashboard
          </button>
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

      {noteQuery.isLoading ? <p>Note yuklanmoqda...</p> : null}
      {noteQuery.error ? <p className="error-text">{(noteQuery.error as Error).message}</p> : null}

      {note ? (
        <div className="editor-layout frame-reveal">
          <section className="glass-card editor-main frame-reveal">
            <input
              className="editor-title"
              value={titleDraft ?? note.title}
              onChange={(event) =>
                setTitleDraftState({
                  noteId,
                  value: event.target.value,
                })
              }
              placeholder="Untitled note"
            />
            <div className="presence-strip">
              <span className="presence-label">Online</span>
              <div className="presence-list">
                {onlineUsers.map((onlineUser) => (
                  <span className="presence-user" key={onlineUser.socketId}>
                    <span className="presence-dot" style={{ backgroundColor: onlineUser.color }} />
                    {onlineUser.name}
                  </span>
                ))}
              </div>
            </div>
            {accessToken && user ? (
              <CollaborativeEditor
                noteId={noteId}
                accessToken={accessToken}
                currentUser={user}
                onCursorChange={onCursorChange}
              />
            ) : null}
          </section>

          <aside className="glass-card editor-side frame-reveal">
            <div className="side-panel-tabs">
              <button
                className={"side-tab" + (activePanel === "collaborators" ? " active" : "")}
                onClick={() => setActivePanel("collaborators")}
                type="button"
              >
                Hamkorlar
              </button>
              <button
                className={"side-tab" + (activePanel === "comments" ? " active" : "")}
                onClick={() => setActivePanel("comments")}
                type="button"
              >
                Kommentlar
              </button>
              <button
                className={"side-tab" + (activePanel === "history" ? " active" : "")}
                onClick={() => setActivePanel("history")}
                type="button"
              >
                Tarix
              </button>
            </div>

            {activePanel === "collaborators" ? (
              <section className="panel">
                <h3>Hamkorlar</h3>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!inviteEmailTrimmed) {
                    setPanelError("Email kiriting.");
                    return;
                  }
                  inviteMutation.mutate();
                }}
                style={{ display: "flex", gap: 8, marginBottom: 10 }}
              >
                <div className="suggestion-wrap">
                  <input
                    className="input"
                    placeholder="Invite by email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    onFocus={() => setInviteInputFocused(true)}
                    onBlur={() => {
                      window.setTimeout(() => setInviteInputFocused(false), 120);
                    }}
                    disabled={!canManageCollaborators}
                  />
                  {canManageCollaborators && inviteInputFocused && inviteEmailTrimmed.length >= 2 ? (
                    <div className="suggestion-list">
                      {collaboratorSuggestionsQuery.isLoading ? (
                        <p className="suggestion-empty">Qidirilmoqda...</p>
                      ) : null}
                      {collaboratorSuggestionsQuery.isError ? (
                        <p className="suggestion-empty">Takliflar yuklanmadi.</p>
                      ) : null}
                      {!collaboratorSuggestionsQuery.isLoading &&
                      !collaboratorSuggestionsQuery.isError &&
                      (collaboratorSuggestionsQuery.data?.length ?? 0) === 0 ? (
                        <p className="suggestion-empty">Mos foydalanuvchi topilmadi.</p>
                      ) : null}
                      {(collaboratorSuggestionsQuery.data ?? []).map((candidate) => (
                        <button
                          key={candidate.id}
                          className="suggestion-item"
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => {
                            setInviteEmail(candidate.email);
                            setInviteInputFocused(false);
                            setPanelError(null);
                          }}
                        >
                          <span>{candidate.name}</span>
                          <span>{candidate.email}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  className="button secondary"
                  disabled={!canManageCollaborators || inviteMutation.isPending || !inviteEmailTrimmed}
                  type="submit"
                >
                  Qo&apos;shish
                </button>
              </form>
              {note.members.map((member) => (
                <div
                  key={member.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
                >
                  <div className="member-row">
                    <UserAvatar size="sm" user={member.user} />
                    <span>
                      {member.user.name} ({member.role.toLowerCase()})
                    </span>
                  </div>
                  {canManageCollaborators && member.role !== "OWNER" ? (
                    <button
                      className="button danger"
                      onClick={() => removeMutation.mutate(member.user.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              </section>
            ) : null}

            {activePanel === "comments" ? (
              <section className="panel">
                <h3>Kommentlar</h3>
              <form onSubmit={onSubmitComment} style={{ marginBottom: 10 }}>
                <textarea
                  className="input"
                  placeholder="Komment yozing"
                  rows={3}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
                <button className="button" style={{ marginTop: 8 }} type="submit">
                  Yuborish
                </button>
              </form>
              {(commentsQuery.data ?? []).map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <p className="comment-meta">
                    {comment.author.name} • {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </p>
                  <p style={{ margin: "0 0 8px" }}>{comment.body}</p>
                  {!comment.resolved ? (
                    <button
                      className="button secondary"
                      onClick={() => {
                        socketRef.current?.emit("comment:resolve", { commentId: comment.id });
                      }}
                      type="button"
                    >
                      Yopish
                    </button>
                  ) : (
                    <span className="pill">Yopilgan</span>
                  )}
                </article>
              ))}
              </section>
            ) : null}

            {activePanel === "history" ? (
              <section className="panel">
                <h3>Tarix</h3>
              {versions.map((version) => (
                <div
                  key={version.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
                >
                  <span style={{ fontSize: 13 }}>
                    {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                  </span>
                  <button
                    className="button secondary"
                    onClick={() => restoreMutation.mutate(version.id)}
                    type="button"
                  >
                    Qaytarish
                  </button>
                </div>
              ))}
              </section>
            ) : null}

            {panelError ? <p className="error-text">{panelError}</p> : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
};

export default function NotePage() {
  return (
    <AuthGuard>
      <NotePageContent />
    </AuthGuard>
  );
}
