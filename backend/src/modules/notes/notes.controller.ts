import { Request, Response } from "express";
import { HttpError } from "../../shared/errors/http-error";
import { notesService } from "./notes.service";
import { RealtimeGateway } from "../../socket/realtime-gateway";

const getUserId = (req: Request): string => {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }

  return req.user.id;
};

export const notesController = {
  async create(req: Request, res: Response): Promise<void> {
    const note = await notesService.createNote(getUserId(req), req.body.title);
    res.status(201).json({ note });
  },

  async list(req: Request, res: Response): Promise<void> {
    const notes = await notesService.listNotes(getUserId(req));
    res.status(200).json({ notes });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const note = await notesService.getNote(String(req.params.noteId), getUserId(req));
    res.status(200).json({ note });
  },

  async update(req: Request, res: Response): Promise<void> {
    const note = await notesService.updateNote(String(req.params.noteId), getUserId(req), req.body);
    res.status(200).json({ note });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await notesService.deleteNote(String(req.params.noteId), getUserId(req));
    res.status(204).send();
  },

  async addCollaborator(req: Request, res: Response): Promise<void> {
    const result = await notesService.addCollaborator(
      String(req.params.noteId),
      getUserId(req),
      req.body.email,
    );

    const realtimeGateway = req.app.get("realtimeGateway") as RealtimeGateway | undefined;
    realtimeGateway?.emitCollaboratorChanged({
      noteId: String(req.params.noteId),
      actorId: getUserId(req),
      targetUserId: result.targetUserId,
      action: "added",
    });

    res.status(200).json({ note: result.note });
  },

  async suggestCollaborators(req: Request, res: Response): Promise<void> {
    const users = await notesService.suggestCollaborators(
      String(req.params.noteId),
      getUserId(req),
      String(req.query.query ?? ""),
    );

    res.status(200).json({ users });
  },

  async removeCollaborator(req: Request, res: Response): Promise<void> {
    const result = await notesService.removeCollaborator(
      String(req.params.noteId),
      getUserId(req),
      String(req.params.userId),
    );

    const realtimeGateway = req.app.get("realtimeGateway") as RealtimeGateway | undefined;
    realtimeGateway?.emitCollaboratorChanged({
      noteId: String(req.params.noteId),
      actorId: getUserId(req),
      targetUserId: result.targetUserId,
      action: "removed",
    });

    res.status(200).json({ note: result.note });
  },
};
