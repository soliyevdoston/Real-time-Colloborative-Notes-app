import { createHash } from "crypto";

export const hashToken = (raw: string): string => {
  return createHash("sha256").update(raw).digest("hex");
};
