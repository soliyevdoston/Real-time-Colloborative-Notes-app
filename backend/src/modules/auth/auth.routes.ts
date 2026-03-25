import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { validateBody } from "../../shared/middleware/validate";
import { loginSchema, registerSchema, updateProfileSchema } from "./auth.schema";
import { authController } from "./auth.controller";
import { requireAuth } from "../../shared/middleware/auth";
import { uploadAvatar } from "../../shared/middleware/upload";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(authController.register));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
authRouter.patch(
  "/profile",
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(authController.updateProfile),
);
authRouter.post("/avatar", requireAuth, uploadAvatar, asyncHandler(authController.uploadAvatar));
