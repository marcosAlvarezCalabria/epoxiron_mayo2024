import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export const requireHermesSecret = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const secret = request.header("x-epoxiron-hermes-secret");
  if (secret !== env.HERMES_SHARED_SECRET) {
    response.status(401).json({ error: "No autorizado" });
    return;
  }

  next();
};

