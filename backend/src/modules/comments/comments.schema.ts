import { z } from "zod";

export const noteIdParamSchema = z.object({
  noteId: z.string().min(1),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export const commentIdParamSchema = z.object({
  commentId: z.string().min(1),
});
