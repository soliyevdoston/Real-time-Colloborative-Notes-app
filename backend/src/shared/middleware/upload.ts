import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/http-error";

const uploadsRoot = path.resolve(process.cwd(), "uploads", "avatars");

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsRoot);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    if (!isImage) {
      cb(new HttpError(400, "Faqat rasm fayllariga ruxsat beriladi"));
      return;
    }

    cb(null, true);
  },
});

export const uploadAvatar = (req: Request, res: Response, next: NextFunction): void => {
  upload.single("avatar")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(400, "Rasm hajmi 3MB dan oshmasligi kerak"));
      return;
    }

    next(error);
  });
};
