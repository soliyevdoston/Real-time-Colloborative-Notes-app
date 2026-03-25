import { z } from "zod";

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const noteIdParamSchema = z.object({
  noteId: z.string().min(1),
});

export const addCollaboratorSchema = z.object({
  email: z.string().trim().email(),
});

export const collaboratorParamSchema = z.object({
  noteId: z.string().min(1),
  userId: z.string().min(1),
});

export const collaboratorSuggestionQuerySchema = z.object({
  query: z.string().trim().min(1),
});
