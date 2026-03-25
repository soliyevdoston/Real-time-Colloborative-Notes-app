import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env";

export type JwtUserPayload = {
  sub: string;
  email: string;
  name: string;
};

export const signAccessToken = (payload: JwtUserPayload): string => {
  const expiresIn = env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn,
  });
};

export const verifyAccessToken = (token: string): JwtUserPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUserPayload;
};

export const signRefreshToken = (payload: Pick<JwtUserPayload, "sub">): string => {
  const expiresIn = `${env.REFRESH_TOKEN_TTL_DAYS}d` as SignOptions["expiresIn"];
  return jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
};

export const verifyRefreshToken = (token: string): { sub: string; jti: string } => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; jti: string };
};
