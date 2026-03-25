import { Router } from "express";
import { requireAuth } from "../../shared/middleware/auth";
import { validateParams } from "../../shared/middleware/validate";
import { asyncHandler } from "../../shared/utils/async-handler";
import { noteIdParamSchema, restoreVersionParamSchema } from "./versions.schema";
import { versionsController } from "./versions.controller";

export const versionsRouter = Router();

versionsRouter.use(requireAuth);

versionsRouter.get(
  "/:noteId/versions",
  validateParams(noteIdParamSchema),
  asyncHandler(versionsController.list),
);

versionsRouter.post(
  "/:noteId/versions/:versionId/restore",
  validateParams(restoreVersionParamSchema),
  asyncHandler(versionsController.restore),
);
