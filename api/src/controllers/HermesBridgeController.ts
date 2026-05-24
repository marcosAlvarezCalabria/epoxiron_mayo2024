import type { Request, Response } from "express";
import { HermesClient } from "../integrations/hermes/HermesClient.js";
import { getRouteParam } from "./requestParsers.js";

export class HermesBridgeController {
  public constructor(private readonly hermesClient: HermesClient) {}

  public createSession = async (_request: Request, response: Response) => {
    const session = await this.hermesClient.createSession();
    response.status(201).json(session);
  };

  public getSession = async (request: Request, response: Response) => {
    const session = await this.hermesClient.getSession(getRouteParam(request.params.id));
    response.json(session);
  };

  public sendMessage = async (request: Request, response: Response) => {
    const session = await this.hermesClient.sendMessage(getRouteParam(request.params.id), request.body.content);
    response.json(session);
  };

  public confirmProposal = async (request: Request, response: Response) => {
    const result = await this.hermesClient.confirmProposal(getRouteParam(request.params.id));
    response.json(result);
  };

  public rejectProposal = async (request: Request, response: Response) => {
    const result = await this.hermesClient.rejectProposal(getRouteParam(request.params.id));
    response.json(result);
  };

  public listTasks = async (_request: Request, response: Response) => {
    const tasks = await this.hermesClient.listTasks();
    response.json(tasks);
  };
}
