import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { notesRouter } from "../modules/notes/notes.routes";
import { noteCommentsRouter, commentsRouter } from "../modules/comments/comments.routes";
import { versionsRouter } from "../modules/versions/versions.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "realtime-collab-notes-backend" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/notes", notesRouter);
apiRouter.use("/notes", noteCommentsRouter);
apiRouter.use("/notes", versionsRouter);
apiRouter.use("/comments", commentsRouter);
