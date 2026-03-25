import { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/http-error";
import { verifyAccessToken } from "../utils/jwt";

const parseBearerToken = (header?: string): string | null => {
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = parseBearerToken(req.headers.authorization);

  if (!token) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    next();
  } catch (_error) {
    next(new HttpError(401, "Invalid or expired access token"));
  }
};
