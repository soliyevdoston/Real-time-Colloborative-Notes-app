import { Router } from "express";
import { requireAuth } from "../../shared/middleware/auth";
import { validateBody, validateParams, validateQuery } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  addCollaboratorSchema,
  collaboratorParamSchema,
  collaboratorSuggestionQuerySchema,
  createNoteSchema,
  noteIdParamSchema,
  updateNoteSchema,
} from "./notes.schema";
import { notesController } from "./notes.controller";

export const notesRouter = Router();

notesRouter.use(requireAuth);

notesRouter.get("/", asyncHandler(notesController.list));
notesRouter.post("/", validateBody(createNoteSchema), asyncHandler(notesController.create));
notesRouter.get("/:noteId", validateParams(noteIdParamSchema), asyncHandler(notesController.getById));
notesRouter.patch(
  "/:noteId",
  validateParams(noteIdParamSchema),
  validateBody(updateNoteSchema),
  asyncHandler(notesController.update),
);
notesRouter.delete(
  "/:noteId",
  validateParams(noteIdParamSchema),
  asyncHandler(notesController.remove),
);
notesRouter.post(
  "/:noteId/collaborators",
  validateParams(noteIdParamSchema),
  validateBody(addCollaboratorSchema),
  asyncHandler(notesController.addCollaborator),
);
notesRouter.get(
  "/:noteId/collaborators/suggestions",
  validateParams(noteIdParamSchema),
  validateQuery(collaboratorSuggestionQuerySchema),
  asyncHandler(notesController.suggestCollaborators),
);
notesRouter.delete(
  "/:noteId/collaborators/:userId",
  validateParams(collaboratorParamSchema),
  asyncHandler(notesController.removeCollaborator),
);
