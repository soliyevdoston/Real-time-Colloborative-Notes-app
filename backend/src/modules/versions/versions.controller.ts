import { Request, Response } from "express";
import { HttpError } from "../../shared/errors/http-error";
import { notesService } from "../notes/notes.service";

const getUserId = (req: Request): string => {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }

  return req.user.id;
};

export const versionsController = {
  async list(req: Request, res: Response): Promise<void> {
    const versions = await notesService.listVersions(String(req.params.noteId), getUserId(req));
    res.status(200).json({ versions });
  },

  async restore(req: Request, res: Response): Promise<void> {
    const version = await notesService.restoreVersion(
      String(req.params.noteId),
      String(req.params.versionId),
      getUserId(req),
    );

    res.status(200).json({ version });
  },
};
