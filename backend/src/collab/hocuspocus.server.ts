import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { prisma } from "../shared/db/prisma";
import { env } from "../shared/config/env";
import { verifyAccessToken } from "../shared/utils/jwt";
import { notesService } from "../modules/notes/notes.service";

type StartRealtimeDocumentServerParams = {
  onVersionCreated: (noteId: string, version: { id: string; createdAt: Date }) => void;
};

const parseToken = (token?: string): string | null => {
  if (!token) return null;
  if (token.startsWith("Bearer ")) return token.slice(7);
  return token;
};

export const startRealtimeDocumentServer = async ({
  onVersionCreated,
}: StartRealtimeDocumentServerParams): Promise<Server> => {
  const server = new Server({
    port: env.HOCUSPOCUS_PORT,
    debounce: 2000,
    maxDebounce: 10000,
    async onAuthenticate({ token, documentName }) {
      const normalizedToken = parseToken(token);
      if (!normalizedToken) {
        throw new Error("Missing token");
      }

      const user = verifyAccessToken(normalizedToken);
      const canView = await notesService.canViewNote(documentName, user.sub);
      if (!canView) {
        throw new Error("Forbidden");
      }

      return {
        userId: user.sub,
      };
    },

    async onLoadDocument({ documentName }) {
      const doc = new Y.Doc();
      const note = await prisma.note.findUnique({
        where: { id: documentName },
        select: {
          ydocState: true,
        },
      });

      if (note?.ydocState) {
        const update = Buffer.from(note.ydocState, "base64");
        Y.applyUpdate(doc, update);
      }

      return doc;
    },

    async onStoreDocument({ documentName, document, context }) {
      const update = Y.encodeStateAsUpdate(document);
      const stateBase64 = Buffer.from(update).toString("base64");
      const version = await notesService.saveRealtimeState({
        noteId: documentName,
        stateBase64,
        changedById: context?.userId as string | undefined,
      });

      if (version) {
        onVersionCreated(documentName, {
          id: version.id,
          createdAt: version.createdAt,
        });
      }
    },
  });

  await server.listen();
  return server;
};
