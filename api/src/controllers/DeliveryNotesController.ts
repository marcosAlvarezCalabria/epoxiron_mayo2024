import type { Request, Response } from "express";
import type {
  CalculatePriceUseCase,
  ChangeDeliveryNoteStatusUseCase,
  CreateDeliveryNoteUseCase,
  DeleteDeliveryNoteUseCase,
  GetDashboardSummaryUseCase,
  GetDeliveryNoteUseCase,
  GetDeliveryNotesUseCase,
  UpdateDeliveryNoteUseCase
} from "../application/use-cases/deliveryNotes.js";
import type { GetCustomerUseCase } from "../application/use-cases/customers.js";
import { getRouteParam, getStatusQuery } from "./requestParsers.js";

export class DeliveryNotesController {
  public constructor(
    private readonly getDeliveryNotesUseCase: GetDeliveryNotesUseCase,
    private readonly getDeliveryNoteUseCase: GetDeliveryNoteUseCase,
    private readonly createDeliveryNoteUseCase: CreateDeliveryNoteUseCase,
    private readonly updateDeliveryNoteUseCase: UpdateDeliveryNoteUseCase,
    private readonly deleteDeliveryNoteUseCase: DeleteDeliveryNoteUseCase,
    private readonly changeDeliveryNoteStatusUseCase: ChangeDeliveryNoteStatusUseCase,
    private readonly calculatePriceUseCase: CalculatePriceUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase
  ) {}

  public list = async (request: Request, response: Response) => {
    const filters = {
      status: getStatusQuery(request.query.status),
      customerId: typeof request.query.customerId === "string" ? request.query.customerId : undefined,
      today: request.query.today === "true"
    };
    const deliveryNotes = await this.getDeliveryNotesUseCase.execute(filters);
    response.json({ deliveryNotes });
  };

  public getById = async (request: Request, response: Response) => {
    const deliveryNote = await this.getDeliveryNoteUseCase.execute(getRouteParam(request.params.id));
    response.json({ deliveryNote });
  };

  public create = async (request: Request, response: Response) => {
    const deliveryNote = await this.createDeliveryNoteUseCase.execute(request.body);
    response.status(201).json({ deliveryNote });
  };

  public update = async (request: Request, response: Response) => {
    const deliveryNote = await this.updateDeliveryNoteUseCase.execute(getRouteParam(request.params.id), request.body);
    response.json({ deliveryNote });
  };

  public delete = async (request: Request, response: Response) => {
    await this.deleteDeliveryNoteUseCase.execute(getRouteParam(request.params.id));
    response.status(204).send();
  };

  public updateStatus = async (request: Request, response: Response) => {
    const deliveryNote = await this.changeDeliveryNoteStatusUseCase.execute(
      getRouteParam(request.params.id),
      request.body.status
    );
    response.json({ deliveryNote });
  };

  public calculatePrice = async (request: Request, response: Response) => {
    const customer = await this.getCustomerUseCase.execute(request.body.customerId);
    const pricing = this.calculatePriceUseCase.execute(request.body.item, customer);
    response.json({ pricing });
  };

  public getDashboardSummary = async (_request: Request, response: Response) => {
    const summary = await this.getDashboardSummaryUseCase.execute();
    response.json(summary);
  };
}
