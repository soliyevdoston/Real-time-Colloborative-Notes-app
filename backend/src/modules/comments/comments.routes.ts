import { Router } from "express";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody, validateParams } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  commentIdParamSchema,
  createCommentSchema,
  noteIdParamSchema,
} from "./comments.schema";
import { commentsController } from "./comments.controller";

export const noteCommentsRouter = Router();
export const commentsRouter = Router();

noteCommentsRouter.use(requireAuth);
commentsRouter.use(requireAuth);

noteCommentsRouter.get(
  "/:noteId/comments",
  validateParams(noteIdParamSchema),
  asyncHandler(commentsController.list),
);
noteCommentsRouter.post(
  "/:noteId/comments",
  validateParams(noteIdParamSchema),
  validateBody(createCommentSchema),
  asyncHandler(commentsController.create),
);

commentsRouter.patch(
  "/:commentId/resolve",
  validateParams(commentIdParamSchema),
  asyncHandler(commentsController.resolve),
);
