"use client";

import { AuthGuard } from "@/components/auth-guard";
import { CollaborativeEditor, EditorCommandApi } from "@/components/editor/collab-editor";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { getErrorMessage } from "@/lib/error-message";
import { parseApiError } from "@/lib/api";
import { colorFromId } from "@/lib/presence-color";
import { routeParamToString } from "@/lib/routing";
import {
  CollaboratorChangedEvent,
  CollaboratorSuggestion,
  CommentItem,
  LinkAccessMode,
  LinkPermissionMode,
  NoteSummary,
  NoteVersion,
  PendingInvite,
  PresenceUser,
} from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";
import {
  ArrowLeft,
  CircleUserRound,
  Copy,
  Globe,
  History,
  Lock,
  MessageSquareText,
  Settings2,
  UserPlus,
  X,
} from "lucide-react";
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
  delivery?: "added" | "invited";
  invitedEmail?: string | null;
};

type NoteInvitesResponse = {
  invites: PendingInvite[];
};

type NoticeState = {
  type: "success" | "error";
  text: string;
};

type SidePanel = "collaborators" | "comments" | "history";

const NotePageContent = () => {
  const params = useParams<{ id: string | string[] }>();
  const noteId = useMemo(() => routeParamToString(params.id), [params.id]);
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
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareAccessDraft, setShareAccessDraft] = useState<LinkAccessMode>("RESTRICTED");
  const [sharePermissionDraft, setSharePermissionDraft] = useState<LinkPermissionMode>("VIEW");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editorApi, setEditorApi] = useState<EditorCommandApi | null>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>("collaborators");
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [zoom, setZoom] = useState<number>(100);
  const [fontFamily, setFontFamily] = useState<string>("Arial, sans-serif");
  const [fontSize, setFontSize] = useState<number>(11);

  const socketRef = useRef<Socket | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
      Boolean(noteQuery.data?.note.currentAccessRole === "OWNER") && inviteEmailTrimmed.length >= 2,
    staleTime: 5000,
  });

  const pendingInvitesQuery = useQuery({
    queryKey: ["pending-invites", noteId],
    queryFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId + "/invites");
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as NoteInvitesResponse;
      return data.invites;
    },
    enabled: Boolean(noteQuery.data?.note.currentAccessRole === "OWNER"),
    staleTime: 5000,
  });

  const titleDraft = titleDraftState.noteId === noteId ? titleDraftState.value : null;
  const note = noteQuery.data?.note;
  const comments = commentsQuery.data ?? [];
  const versions = versionsQuery.data ?? [];
  const pendingInvites = pendingInvitesQuery.data ?? [];

  const canManageCollaborators = note?.currentAccessRole === "OWNER";
  const canEdit = note?.currentAccessRole === "OWNER" || note?.currentAccessRole === "EDITOR";

  const setErrorNotice = (error: unknown, fallback: string) => {
    setNotice({
      type: "error",
      text: getErrorMessage(error, fallback),
    });
  };

  useEffect(() => {
    const nextTitle = (titleDraft ?? note?.title ?? "").trim();

    if (!note || !canEdit || titleDraft === null || !nextTitle || nextTitle === note.title) {
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
  }, [authenticatedFetch, canEdit, note, noteId, queryClient, titleDraft]);

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

    socket.on("share:updated", (event: { noteId: string }) => {
      if (event.noteId !== noteId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    });

    socket.on("collaborator:changed", (event: CollaboratorChangedEvent) => {
      if (event.noteId !== noteId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });

      if (event.targetUserId === user.id && event.action === "added") {
        setNotice({ type: "success", text: "Siz bu hujjatga hamkor sifatida qo'shildingiz." });
      }

      if (event.targetUserId === user.id && event.action === "removed") {
        setNotice({ type: "error", text: "Siz ushbu hujjatdan olib tashlandingiz." });
      }
    });

    socket.on("collaboration:access-removed", (event: { noteId: string }) => {
      if (event.noteId !== noteId) {
        return;
      }

      setNotice({ type: "error", text: "Sizning ushbu hujjat uchun ruxsatingiz bekor qilindi." });
      router.replace("/dashboard");
    });

    return () => {
      socket.emit("presence:leave", { noteId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, noteId, queryClient, router, user]);

  useEffect(() => {
    if (!openMenu) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenu]);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId + "/collaborators", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmailTrimmed }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      return (await response.json()) as NoteResponse;
    },
    onSuccess: (data) => {
      setInviteEmail("");
      if (data.delivery === "invited") {
        setNotice({
          type: "success",
          text: `${data.invitedEmail} manziliga taklif yuborildi. Foydalanuvchi tizimga kirgach hujjat avtomatik qo'shiladi.`,
        });
      } else {
        setNotice({ type: "success", text: "Hamkor muvaffaqiyatli qo'shildi." });
      }

      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      void queryClient.invalidateQueries({ queryKey: ["pending-invites", noteId] });
    },
    onError: (err) => {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Hamkor qo'shishda xatolik yuz berdi",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const response = await authenticatedFetch("/notes/" + noteId + "/collaborators/" + memberUserId, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: () => {
      setNotice({ type: "success", text: "Hamkor hujjatdan olib tashlandi." });
      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    },
    onError: (err) => {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Hamkorni olib tashlashda xatolik yuz berdi",
      });
    },
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const response = await authenticatedFetch("/notes/" + noteId + "/invites/" + inviteId, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
    },
    onSuccess: () => {
      setNotice({ type: "success", text: "Kutilayotgan taklif olib tashlandi." });
      void queryClient.invalidateQueries({ queryKey: ["pending-invites", noteId] });
    },
    onError: (err) => {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Taklifni olib tashlashda xatolik yuz berdi",
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch("/notes/" + noteId + "/share", {
        method: "PATCH",
        body: JSON.stringify({
          linkAccess: shareAccessDraft,
          linkPermission: sharePermissionDraft,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      return (await response.json()) as NoteResponse;
    },
    onSuccess: () => {
      setNotice({ type: "success", text: "Hujjat ulashish sozlamalari yangilandi." });
      setIsShareOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    },
    onError: (err) => {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Ulashish sozlamasini saqlashda xatolik yuz berdi",
      });
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
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Versiyani qaytarishda xatolik yuz berdi",
      });
    },
  });

  const quickCreateMutation = useMutation({
    mutationFn: async () => {
      const response = await authenticatedFetch("/notes", {
        method: "POST",
        body: JSON.stringify({ title: "Yangi hujjat" }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      return (await response.json()) as { note: NoteSummary };
    },
    onSuccess: ({ note: createdNote }) => {
      router.push("/notes/" + createdNote.id);
    },
    onError: (err) => {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Yangi hujjat yaratishda xatolik",
      });
    },
  });

  const onSubmitComment = (event: FormEvent) => {
    event.preventDefault();

    if (!canEdit) {
      setNotice({ type: "error", text: "Faqat tahrirlovchi foydalanuvchi komment qoldira oladi." });
      return;
    }

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

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/notes/${noteId}`;
  }, [noteId]);

  const openSidePanel = (panel: SidePanel) => {
    setActivePanel(panel);
    setIsSidePanelOpen(true);
  };

  const openShareModal = () => {
    if (note) {
      setShareAccessDraft(note.linkAccess);
      setSharePermissionDraft(note.linkPermission);
    }
    setIsShareOpen(true);
  };

  const copyShareLink = async () => {
    if (!shareLink) {
      return;
    }

    await navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1200);
  };

  const runMenuAction = async (actionId: string) => {
    try {
      switch (actionId) {
        case "file:new":
          quickCreateMutation.mutate();
          break;
        case "file:share":
          openShareModal();
          break;
        case "file:copy":
          await copyShareLink();
          break;
        case "file:print":
          window.print();
          break;
        case "file:dashboard":
          router.push("/dashboard");
          break;
        case "edit:undo":
          editorApi?.undo();
          break;
        case "edit:redo":
          editorApi?.redo();
          break;
        case "edit:selectAll":
          editorApi?.selectAll();
          break;
        case "view:comments":
          openSidePanel("comments");
          break;
        case "view:history":
          openSidePanel("history");
          break;
        case "view:collab":
          openSidePanel("collaborators");
          break;
        case "view:fullscreen":
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          } else {
            await document.exitFullscreen();
          }
          break;
        case "insert:bullet":
          editorApi?.toggleBulletList();
          break;
        case "insert:ordered":
          editorApi?.toggleOrderedList();
          break;
        case "insert:rule":
          editorApi?.insertHorizontalRule();
          break;
        case "format:bold":
          editorApi?.toggleBold();
          break;
        case "format:italic":
          editorApi?.toggleItalic();
          break;
        case "format:h1":
          editorApi?.setHeading1();
          break;
        case "format:p":
          editorApi?.setParagraph();
          break;
        case "tools:share":
          openShareModal();
          break;
        case "tools:copyLink":
          await copyShareLink();
          break;
        case "tools:logout":
          await logout();
          router.replace("/auth/login");
          break;
        case "help:guide":
          setNotice({
            type: "success",
            text: "Yordam: Fayl menyusidan ulashish va print, Tahrirlash/Formatdan matnni boshqaring.",
          });
          break;
        case "help:shortcuts":
          setNotice({
            type: "success",
            text: "Shortcutlar: Cmd/Ctrl+B (qalin), Cmd/Ctrl+I (kursiv), Cmd/Ctrl+Z (undo).",
          });
          break;
        default:
          break;
      }
    } catch {
      setNotice({
        type: "error",
        text: "Menyu amalini bajarishda xatolik yuz berdi.",
      });
    } finally {
      setOpenMenu(null);
    }
  };

  const menuGroups = [
    {
      title: "Fayl",
      items: [
        { id: "file:new", label: "Yangi hujjat" },
        { id: "file:share", label: "Ulashish" },
        { id: "file:copy", label: "Havolani nusxalash" },
        { id: "file:print", label: "Chop etish" },
        { id: "file:dashboard", label: "Bosh sahifa" },
      ],
    },
    {
      title: "Tahrirlash",
      items: [
        { id: "edit:undo", label: "Bekor qilish", disabled: !canEdit },
        { id: "edit:redo", label: "Qayta tiklash", disabled: !canEdit },
        { id: "edit:selectAll", label: "Hammasini belgilash", disabled: !editorApi },
      ],
    },
    {
      title: "Ko'rish",
      items: [
        { id: "view:comments", label: "Kommentlar bo'limi" },
        { id: "view:history", label: "Tarix bo'limi" },
        { id: "view:collab", label: "Hamkorlar bo'limi" },
        { id: "view:fullscreen", label: "To'liq ekran" },
      ],
    },
    {
      title: "Kiritish",
      items: [
        { id: "insert:bullet", label: "Belgili ro'yxat", disabled: !canEdit },
        { id: "insert:ordered", label: "Raqamli ro'yxat", disabled: !canEdit },
        { id: "insert:rule", label: "Gorizontal chiziq", disabled: !canEdit },
      ],
    },
    {
      title: "Format",
      items: [
        { id: "format:bold", label: "Qalin", disabled: !canEdit },
        { id: "format:italic", label: "Kursiv", disabled: !canEdit },
        { id: "format:h1", label: "Sarlavha 1", disabled: !canEdit },
        { id: "format:p", label: "Oddiy matn", disabled: !canEdit },
      ],
    },
    {
      title: "Vositalar",
      items: [
        { id: "tools:share", label: "Ulashish sozlamalari" },
        { id: "tools:copyLink", label: "Havolani nusxalash" },
        { id: "tools:logout", label: "Tizimdan chiqish" },
      ],
    },
    {
      title: "Yordam",
      items: [
        { id: "help:guide", label: "Qo'llanma" },
        { id: "help:shortcuts", label: "Tezkor tugmalar" },
      ],
    },
  ] as const;

  const accessModeLabel =
    note?.linkAccess === "ANYONE_WITH_LINK" ? "Havolaga ega har kim" : "Faqat qo'shilganlar";
  const permissionModeLabel = note?.linkPermission === "EDIT" ? "Tahrirlash" : "Faqat o'qish";

  return (
    <main className="page-wrap">
      <div className="topbar docs-topbar">
        <div>
          <p className="workspace-eyebrow">Jamoaviy hujjat</p>
          <h1 className="workspace-title">{note?.title ?? "Yuklanmoqda..."}</h1>
          <p className="workspace-subtitle">
            Real-time hamkorlik: kursordan tortib versiyagacha hammasi jonli.
          </p>
        </div>

        <div className="topbar-actions">
          <button className="button secondary" onClick={() => openSidePanel("comments")} type="button">
            <MessageSquareText size={16} /> Kommentlar
          </button>
          <button className="button secondary" onClick={() => openSidePanel("history")} type="button">
            <History size={16} /> Tarix
          </button>
          <button
            className="button secondary"
            onClick={openShareModal}
            type="button"
          >
            <Settings2 size={16} /> Ulashish
          </button>
          <button className="button secondary" onClick={() => router.push("/dashboard")} type="button">
            <ArrowLeft size={16} /> Bosh sahifa
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

      {noteQuery.isLoading ? <p>Hujjat yuklanmoqda...</p> : null}
      {noteQuery.error ? <p className="error-text">{(noteQuery.error as Error).message}</p> : null}

      {note ? (
        <>
          <div className="docs-menubar frame-reveal" ref={menuRef}>
            {menuGroups.map((group) => (
              <div className="docs-menu-group" key={group.title}>
                <button
                  className={`docs-menu-trigger ${openMenu === group.title ? "active" : ""}`}
                  onClick={() => setOpenMenu((prev) => (prev === group.title ? null : group.title))}
                  type="button"
                >
                  {group.title}
                </button>
                {openMenu === group.title ? (
                  <div className="docs-menu-dropdown">
                    {group.items.map((item) => (
                      <button
                        className="docs-menu-item"
                        disabled={"disabled" in item ? item.disabled : false}
                        key={item.id}
                        onClick={() => {
                          void runMenuAction(item.id);
                        }}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="docs-toolbarbar frame-reveal">
            <select
              className="toolbar-select"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            >
              <option value={90}>90%</option>
              <option value={100}>100%</option>
              <option value={110}>110%</option>
              <option value={125}>125%</option>
            </select>
            <button
              className="button secondary tiny"
              type="button"
              onClick={() => editorApi?.setParagraph()}
              disabled={!canEdit}
            >
              Oddiy matn
            </button>
            <select
              className="toolbar-select"
              value={fontFamily}
              onChange={(event) => setFontFamily(event.target.value)}
            >
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Avenir Next', sans-serif">Avenir Next</option>
              <option value="Georgia, serif">Georgia</option>
            </select>
            <select
              className="toolbar-select"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            >
              <option value={11}>11</option>
              <option value={12}>12</option>
              <option value={14}>14</option>
              <option value={16}>16</option>
            </select>
          </div>

          <div className="docs-mode-banner">
            <span className="pill">Kirish: {accessModeLabel}</span>
            <span className="pill">Rejim: {permissionModeLabel}</span>
            <span className="pill">Rolingiz: {note.currentAccessRole.toLowerCase()}</span>
          </div>

          <div className="docs-workspace frame-reveal">
            <aside className="glass-card docs-left-nav frame-reveal">
              <h4 className="docs-left-title">Varaqlar</h4>
              <button className="docs-tab active" type="button">
                Varaq 1
              </button>
              <p className="docs-left-muted">Sarlavhalar chiqqanda shu yerda avtomatik ko&apos;rinadi.</p>
            </aside>

            <div className="docs-main-stack">
              <section className="glass-card editor-main frame-reveal">
                <input
                  className="editor-title"
                  value={titleDraft ?? note.title}
                  onChange={(event) =>
                    canEdit
                      ? setTitleDraftState({
                          noteId,
                          value: event.target.value,
                        })
                      : null
                  }
                  placeholder="Sarlavhasiz hujjat"
                  readOnly={!canEdit}
                />

                <div className="presence-strip">
                  <span className="presence-label">Onlayn foydalanuvchilar</span>
                  <div className="presence-list">
                    {onlineUsers.length === 0 ? (
                      <span className="presence-user">Hozircha hech kim yo&apos;q</span>
                    ) : null}
                    {onlineUsers.map((onlineUser) => (
                      <span className="presence-user" key={onlineUser.socketId}>
                        <span className="presence-dot" style={{ backgroundColor: onlineUser.color }} />
                        {onlineUser.name}
                      </span>
                    ))}
                  </div>
                </div>

                {!canEdit ? (
                  <div className="readonly-banner">
                    <Lock size={14} /> Siz faqat o&apos;qish rejimidasiz. Tahrirlash uchun egadan ruxsat so&apos;rang.
                  </div>
                ) : null}

                {accessToken && user ? (
                  <CollaborativeEditor
                    noteId={noteId}
                    accessToken={accessToken}
                    currentUser={user}
                    editable={canEdit}
                    zoom={zoom}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    onCursorChange={onCursorChange}
                    onEditorReady={setEditorApi}
                  />
                ) : null}
              </section>
            </div>
          </div>

          {notice ? (
            <p className={notice.type === "error" ? "error-text" : "success-text"}>{notice.text}</p>
          ) : null}

          {isSidePanelOpen ? (
            <div className="docs-side-overlay" onClick={() => setIsSidePanelOpen(false)} role="presentation">
              <aside className="docs-side-drawer frame-reveal" onClick={(event) => event.stopPropagation()}>
                <div className="docs-side-head">
                  <h3>Hujjat paneli</h3>
                  <button className="button secondary" onClick={() => setIsSidePanelOpen(false)} type="button">
                    <X size={16} />
                  </button>
                </div>

                <div className="panel-switcher">
                  <button
                    className={`panel-switch-btn ${activePanel === "collaborators" ? "active" : ""}`}
                    onClick={() => setActivePanel("collaborators")}
                    type="button"
                  >
                    Hamkorlar
                  </button>
                  <button
                    className={`panel-switch-btn ${activePanel === "comments" ? "active" : ""}`}
                    onClick={() => setActivePanel("comments")}
                    type="button"
                  >
                    Kommentlar
                  </button>
                  <button
                    className={`panel-switch-btn ${activePanel === "history" ? "active" : ""}`}
                    onClick={() => setActivePanel("history")}
                    type="button"
                  >
                    Tarix
                  </button>
                </div>

                <div className="inspector-grid">
                  {activePanel === "collaborators" ? (
                    <section className="panel" id="collaborators-panel">
                      <h3>Hamkorlar</h3>

                      <div className="share-link-row">
                        <input className="input share-link-input" readOnly value={shareLink} />
                        <button
                          className="button secondary"
                          onClick={() => {
                            void copyShareLink();
                          }}
                          type="button"
                        >
                          <Copy size={16} />
                          {linkCopied ? "Nusxalandi" : "Havola"}
                        </button>
                      </div>

                      <p className="panel-hint">
                        Havola orqali kirishda hozirgi rejim: <strong>{accessModeLabel}</strong> /{" "}
                        <strong>{permissionModeLabel}</strong>.
                      </p>

                      <button
                        className="button secondary"
                        onClick={openShareModal}
                        type="button"
                        style={{ marginBottom: 10 }}
                      >
                        <UserPlus size={16} /> Ulashish sozlamalari
                      </button>

                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!inviteEmailTrimmed) {
                            setNotice({ type: "error", text: "Elektron pochta kiriting." });
                            return;
                          }
                          inviteMutation.mutate();
                        }}
                        style={{ display: "flex", gap: 8, marginBottom: 10 }}
                      >
                        <div className="suggestion-wrap">
                          <input
                            className="input"
                            placeholder="Elektron pochta orqali taklif qilish"
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

                      {canManageCollaborators ? (
                        <div style={{ marginBottom: 10 }}>
                          <h4 className="panel-subtitle">Kutilayotgan takliflar</h4>
                          {pendingInvitesQuery.isLoading ? (
                            <p className="panel-empty">Takliflar yuklanmoqda...</p>
                          ) : null}
                          {!pendingInvitesQuery.isLoading && pendingInvites.length === 0 ? (
                            <p className="panel-empty">Kutilayotgan taklif yo&apos;q.</p>
                          ) : null}
                          {pendingInvites.map((invite) => (
                            <div className="pending-invite-item" key={invite.id}>
                              <span>{invite.invitedEmail}</span>
                              <button
                                className="button danger"
                                disabled={removeInviteMutation.isPending}
                                onClick={() => removeInviteMutation.mutate(invite.id)}
                                type="button"
                              >
                                Bekor qilish
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {note.members.map((member) => (
                        <div
                          key={member.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
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
                              Olib tashlash
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </section>
                  ) : null}

                  {activePanel === "comments" ? (
                    <section className="panel" id="comments-panel">
                      <h3>Kommentlar</h3>
                      <form onSubmit={onSubmitComment} style={{ marginBottom: 10 }}>
                        <textarea
                          className="input"
                          placeholder={canEdit ? "Komment yozing" : "Faqat o'qish rejimida komment yozib bo'lmaydi"}
                          rows={3}
                          value={commentBody}
                          onChange={(event) => setCommentBody(event.target.value)}
                          disabled={!canEdit}
                        />
                        <button className="button" style={{ marginTop: 8 }} type="submit" disabled={!canEdit}>
                          Yuborish
                        </button>
                      </form>
                      {comments.length === 0 ? <p className="panel-empty">Kommentlar hali yo&apos;q.</p> : null}
                      {comments.map((comment) => (
                        <article className="comment-item" key={comment.id}>
                          <p className="comment-meta">
                            {comment.author.name} •{" "}
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: uz,
                            })}
                          </p>
                          <p style={{ margin: "0 0 8px" }}>{comment.body}</p>
                          {!comment.resolved ? (
                            <button
                              className="button secondary"
                              onClick={() => {
                                if (!canEdit) {
                                  setNotice({
                                    type: "error",
                                    text: "Faqat tahrirlovchi kommentni yopishi mumkin.",
                                  });
                                  return;
                                }

                                socketRef.current?.emit("comment:resolve", { commentId: comment.id });
                              }}
                              type="button"
                              disabled={!canEdit}
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
                    <section className="panel" id="history-panel">
                      <h3>Tarix</h3>
                      {versions.length === 0 ? (
                        <p className="panel-empty">Hozircha saqlangan versiya yo&apos;q.</p>
                      ) : null}
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontSize: 13 }}>
                            {formatDistanceToNow(new Date(version.createdAt), {
                              addSuffix: true,
                              locale: uz,
                            })}
                          </span>
                          <button
                            className="button secondary"
                            onClick={() => restoreMutation.mutate(version.id)}
                            type="button"
                            disabled={!canEdit}
                          >
                            Qaytarish
                          </button>
                        </div>
                      ))}
                      {!canEdit ? (
                        <p className="panel-empty">Faqat o&apos;qish rejimida qaytarish o&apos;chiriladi.</p>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </aside>
            </div>
          ) : null}

          {isShareOpen ? (
            <div className="share-modal-backdrop" onClick={() => setIsShareOpen(false)} role="presentation">
              <div
                className="share-modal frame-reveal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Ulashish sozlamalari"
              >
                <div className="share-modal-head">
                  <h3>Ulashish va ruxsat sozlamalari</h3>
                  <button className="button secondary" onClick={() => setIsShareOpen(false)} type="button">
                    <X size={16} />
                  </button>
                </div>

                <div className="share-mode-grid">
                  <div className="share-mode-block">
                    <p className="share-label">
                      <Globe size={14} /> Havola orqali kirish
                    </p>
                    <select
                      className="input"
                      value={shareAccessDraft}
                      onChange={(event) => setShareAccessDraft(event.target.value as LinkAccessMode)}
                      disabled={!canManageCollaborators}
                    >
                      <option value="RESTRICTED">Faqat taklif qilinganlar</option>
                      <option value="ANYONE_WITH_LINK">Havolaga ega bo&apos;lgan har kim</option>
                    </select>
                  </div>

                  <div className="share-mode-block">
                    <p className="share-label">
                      <Lock size={14} /> Havola foydalanuvchisining roli
                    </p>
                    <select
                      className="input"
                      value={sharePermissionDraft}
                      onChange={(event) => setSharePermissionDraft(event.target.value as LinkPermissionMode)}
                      disabled={!canManageCollaborators}
                    >
                      <option value="VIEW">Faqat o&apos;qish</option>
                      <option value="EDIT">Tahrirlash mumkin</option>
                    </select>
                  </div>
                </div>

                <div className="share-link-row" style={{ marginBottom: 8 }}>
                  <input className="input share-link-input" readOnly value={shareLink} />
                  <button
                    className="button secondary"
                    onClick={() => {
                      void copyShareLink();
                    }}
                    type="button"
                  >
                    <Copy size={16} />
                    {linkCopied ? "Nusxalandi" : "Nusxa olish"}
                  </button>
                </div>

                <p className="panel-hint" style={{ marginBottom: 16 }}>
                  Egasi sifatida siz `Faqat o&apos;qish` va `Tahrirlash` rejimini xohlagan payt almashtira olasiz.
                </p>

                <div className="share-modal-foot">
                  <button className="button secondary" onClick={() => setIsShareOpen(false)} type="button">
                    Bekor qilish
                  </button>
                  <button
                    className="button"
                    onClick={() => shareMutation.mutate()}
                    type="button"
                    disabled={!canManageCollaborators || shareMutation.isPending}
                  >
                    {shareMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
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
