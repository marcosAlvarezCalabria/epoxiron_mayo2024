import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { JwtAccessTokenIssuer } from "../infrastructure/services/JwtAccessTokenIssuer.js";
import { secureSecretEquals } from "../security/secureSecretEquals.js";

const getHermesSecret = (request: Request) =>
  request.header("x-hermes-secret") ?? request.header("x-epoxiron-hermes-secret");
const jwtAccessTokenIssuer = new JwtAccessTokenIssuer(env.JWT_SECRET, env.JWT_EXPIRES_IN);

export const authMiddleware = (request: Request, response: Response, next: NextFunction) => {
  response.locals ??= {};
  const hermesSecret = getHermesSecret(request);
  if (secureSecretEquals(hermesSecret, env.HERMES_SHARED_SECRET)) {
    response.locals.authenticatedActor = "hermes";
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
    const user = jwtAccessTokenIssuer.verify(token);
    response.locals.authenticatedActor = user.email.toLowerCase();
    next();
  } catch {
    response.status(401).json({ error: "Token invalido o expirado" });
  }
};
