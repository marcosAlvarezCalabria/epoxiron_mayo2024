import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { JwtAccessTokenIssuer } from "../infrastructure/services/JwtAccessTokenIssuer.js";

const getHermesSecret = (request: Request) =>
  request.header("x-hermes-secret") ?? request.header("x-epoxiron-hermes-secret");
const jwtAccessTokenIssuer = new JwtAccessTokenIssuer(env.JWT_SECRET, env.JWT_EXPIRES_IN);

export const authMiddleware = (request: Request, response: Response, next: NextFunction) => {
  const hermesSecret = getHermesSecret(request);
  if (hermesSecret && hermesSecret === env.HERMES_SHARED_SECRET) {
    next();
    return;
  }

  const authHeader = request.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    response.status(401).json({ error: "No autorizado" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    jwtAccessTokenIssuer.verify(token);
    next();
  } catch {
    response.status(401).json({ error: "Token invalido o expirado" });
  }
};
