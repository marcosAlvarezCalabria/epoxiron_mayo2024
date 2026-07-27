import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { DomainException } from "../domain/exceptions/DomainException.js";

const respondToDatabaseUnavailable = (error: unknown, response: Response) => {
  console.error("[errorHandler] Base de datos no disponible", error);

  return response.status(503).json({
    error: "Base de datos no disponible"
  });
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: "Datos inválidos",
      details: error.flatten()
    });
  }

  if (error instanceof DomainException) {
    return response.status(error.statusCode).json({
      error: error.message
    });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return respondToDatabaseUnavailable(error, response);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") {
    return respondToDatabaseUnavailable(error, response);
  }

  return response.status(500).json({
    error: "Error interno del servidor"
  });
};
