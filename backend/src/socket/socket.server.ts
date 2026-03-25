import { createServer, Server as HttpServer } from "http";
import { Server } from "socket.io";
import { commentsService } from "../modules/comments/comments.service";
import { PresenceStore } from "../modules/presence/presence.store";
import { notesService } from "../modules/notes/notes.service";
import { env } from "../shared/config/env";
import { verifyAccessToken } from "../shared/utils/jwt";
import { CollaboratorChangedEvent } from "./realtime-gateway";

type SocketUser = {
  id: string;
  name: string;
  email: string;
};

const noteRoom = (noteId: string): string => `note:${noteId}`;

const parseToken = (raw?: string): string | null => {
  if (!raw) return null;
  if (raw.startsWith("Bearer ")) return raw.slice(7);
  return raw;
};

export const createRealtimeSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  const presenceStore = new PresenceStore();
  const socketsByUserId = new Map<string, Set<string>>();

  const registerUserSocket = (userId: string, socketId: string): void => {
    const current = socketsByUserId.get(userId) ?? new Set<string>();
    current.add(socketId);
    socketsByUserId.set(userId, current);
  };

  const unregisterUserSocket = (userId: string, socketId: string): void => {
    const current = socketsByUserId.get(userId);
    if (!current) {
      return;
    }

    current.delete(socketId);
    if (current.size === 0) {
      socketsByUserId.delete(userId);
    }
  };

  const forceLeaveNoteRoom = (noteId: string, userId: string): void => {
    const socketIds = socketsByUserId.get(userId);
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    for (const socketId of socketIds) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) {
        continue;
      }

      socket.leave(noteRoom(noteId));
      (socket.data.activeNotes as Set<string>).delete(noteId);
      socket.emit("collaboration:access-removed", { noteId });
      presenceStore.leave(noteId, socket.id);
    }

    io.to(noteRoom(noteId)).emit("presence:update", {
      noteId,
      users: presenceStore.get(noteId),
    });
  };

  io.use((socket, next) => {
    try {
      const authToken =
        parseToken(socket.handshake.auth?.token as string | undefined) ||
        parseToken(socket.handshake.headers.authorization as string | undefined);

      if (!authToken) {
        next(new Error("Unauthorized"));
        return;
      }

      const payload = verifyAccessToken(authToken);
      socket.data.user = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
      } as SocketUser;
      socket.data.activeNotes = new Set<string>();

      next();
    } catch (_error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    registerUserSocket(user.id, socket.id);

    socket.on("presence:join", async (payload: { noteId: string; color?: string }) => {
      const canView = await notesService.canViewNote(payload.noteId, user.id);
      if (!canView) {
        socket.emit("error:permission", { message: "No access to note" });
        return;
      }

      socket.join(noteRoom(payload.noteId));
      (socket.data.activeNotes as Set<string>).add(payload.noteId);

      const users = presenceStore.join(payload.noteId, {
        userId: user.id,
        name: user.name,
        color: payload.color ?? "#0f766e",
        socketId: socket.id,
      });

      io.to(noteRoom(payload.noteId)).emit("presence:update", {
        noteId: payload.noteId,
        users,
      });
    });

    socket.on("presence:cursor", (payload: { noteId: string; from: number; to: number }) => {
      if (!(socket.data.activeNotes as Set<string>).has(payload.noteId)) {
        return;
      }

      const users = presenceStore.updateCursor(payload.noteId, socket.id, {
        from: payload.from,
        to: payload.to,
      });

      io.to(noteRoom(payload.noteId)).emit("presence:update", {
        noteId: payload.noteId,
        users,
      });
    });

    socket.on("presence:leave", (payload: { noteId: string }) => {
      socket.leave(noteRoom(payload.noteId));
      (socket.data.activeNotes as Set<string>).delete(payload.noteId);

      const users = presenceStore.leave(payload.noteId, socket.id);
      io.to(noteRoom(payload.noteId)).emit("presence:update", {
        noteId: payload.noteId,
        users,
      });
    });

    socket.on("comment:create", async (payload: { noteId: string; body: string }) => {
      const comment = await commentsService.create(payload.noteId, user.id, payload.body);
      io.to(noteRoom(payload.noteId)).emit("comment:created", { noteId: payload.noteId, comment });
    });

    socket.on("comment:resolve", async (payload: { commentId: string }) => {
      const comment = await commentsService.resolve(payload.commentId, user.id);
      io.to(noteRoom(comment.noteId)).emit("comment:resolved", {
        noteId: comment.noteId,
        comment,
      });
    });

    socket.on("disconnect", () => {
      unregisterUserSocket(user.id, socket.id);
      const affectedNotes = presenceStore.removeSocketEverywhere(socket.id);
      for (const noteId of affectedNotes) {
        io.to(noteRoom(noteId)).emit("presence:update", {
          noteId,
          users: presenceStore.get(noteId),
        });
      }
    });
  });

  const emitVersionCreated = (noteId: string, version: { id: string; createdAt: Date }) => {
    io.to(noteRoom(noteId)).emit("version:created", {
      noteId,
      version,
    });
  };

  const emitCollaboratorChanged = (event: CollaboratorChangedEvent) => {
    io.to(noteRoom(event.noteId)).emit("collaborator:changed", event);

    if (event.action === "removed") {
      forceLeaveNoteRoom(event.noteId, event.targetUserId);
    }
  };

  return {
    io,
    emitVersionCreated,
    emitCollaboratorChanged,
  };
};

export const createHttpServer = createServer;
