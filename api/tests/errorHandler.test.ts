import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";

const buildResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  } as unknown as Response;

  (response.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(response);
  return response;
};

const internalMessage =
  "Cannot connect to database at postgresql://private-user:private-password@internal-db:5432/epoxiron";

describe("errorHandler database errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not expose Prisma initialization details to the client", () => {
    const error = new Prisma.PrismaClientInitializationError(internalMessage, "6.8.0");
    const response = buildResponse();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    errorHandler(
      error,
      {} as Request,
      response,
      vi.fn() as NextFunction
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      error: "Base de datos no disponible"
    });
    expect(JSON.stringify((response.json as unknown as ReturnType<typeof vi.fn>).mock.calls))
      .not.toContain("internal-db");
    expect(consoleError).toHaveBeenCalledWith(
      "[errorHandler] Base de datos no disponible",
      error
    );
  });

  it("does not expose Prisma P1001 details to the client", () => {
    const error = new Prisma.PrismaClientKnownRequestError(internalMessage, {
      code: "P1001",
      clientVersion: "6.8.0"
    });
    const response = buildResponse();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    errorHandler(
      error,
      {} as Request,
      response,
      vi.fn() as NextFunction
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      error: "Base de datos no disponible"
    });
    expect(JSON.stringify((response.json as unknown as ReturnType<typeof vi.fn>).mock.calls))
      .not.toContain("private-password");
    expect(consoleError).toHaveBeenCalledWith(
      "[errorHandler] Base de datos no disponible",
      error
    );
  });
});
