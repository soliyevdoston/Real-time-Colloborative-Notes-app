import { Request, Response } from "express";
import { HttpError } from "../../shared/errors/http-error";
import { commentsService } from "./comments.service";

const getUserId = (req: Request): string => {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }

  return req.user.id;
};

export const commentsController = {
  async list(req: Request, res: Response): Promise<void> {
    const comments = await commentsService.list(String(req.params.noteId), getUserId(req));
    res.status(200).json({ comments });
  },

  async create(req: Request, res: Response): Promise<void> {
    const comment = await commentsService.create(
      String(req.params.noteId),
      getUserId(req),
      req.body.body,
    );
    res.status(201).json({ comment });
  },

  async resolve(req: Request, res: Response): Promise<void> {
    const comment = await commentsService.resolve(String(req.params.commentId), getUserId(req));
    res.status(200).json({ comment });
  },
};
