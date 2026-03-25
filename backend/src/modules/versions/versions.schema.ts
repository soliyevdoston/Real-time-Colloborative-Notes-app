import { z } from "zod";

export const noteIdParamSchema = z.object({
  noteId: z.string().min(1),
});

export const restoreVersionParamSchema = z.object({
  noteId: z.string().min(1),
  versionId: z.string().min(1),
});
