import type { NextFunction, Request, Response } from "express";
import { HermesClient } from "../integrations/hermes/HermesClient.js";
import { getRouteParam } from "./requestParsers.js";

const HERMES_UNAVAILABLE = { error: "Hermes no disponible", available: false };

function isConnectionError(err: unknown): boolean {
  return (
    err instanceof Error &&
    ("cause" in err
      ? (err.cause as { code?: string })?.code === "ECONNREFUSED"
      : err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"))
  );
}

export class HermesBridgeController {
  public constructor(private readonly hermesClient: HermesClient) {}

  public createSession = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const session = await this.hermesClient.createSession();
      response.status(201).json(session);
    } catch (err) {
      if (isConnectionError(err)) return void response.status(503).json(HERMES_UNAVAILABLE);
      next(err);
    }
  };

  public getSession = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const session = await this.hermesClient.getSession(getRouteParam(request.params.id));
      response.json(session);
    } catch (err) {
      if (isConnectionError(err)) return void response.status(503).json(HERMES_UNAVAILABLE);
      next(err);
    }
  };

  public sendMessage = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const session = await this.hermesClient.sendMessage(getRouteParam(request.params.id), request.body.content);
      response.json(session);
    } catch (err) {
      if (isConnectionError(err)) return void response.status(503).json(HERMES_UNAVAILABLE);
      next(err);
    }
  };

  public confirmProposal = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.hermesClient.confirmProposal(getRouteParam(request.params.id));
      response.json(result);
    } catch (err) {
      if (isConnectionError(err)) return void response.status(503).json(HERMES_UNAVAILABLE);
      next(err);
    }
  };

  public rejectProposal = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.hermesClient.rejectProposal(getRouteParam(request.params.id));
      response.json(result);
    } catch (err) {
      if (isConnectionError(err)) return void response.status(503).json(HERMES_UNAVAILABLE);
      next(err);
    }
  };

  public listTasks = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const tasks = await this.hermesClient.listTasks();
      response.json(tasks);
    } catch (err) {
      if (isConnectionError(err)) return void response.status(503).json(HERMES_UNAVAILABLE);
      next(err);
    }
  };
}
