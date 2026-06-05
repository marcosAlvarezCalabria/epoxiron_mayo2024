import type { Request, Response } from "express";
import type {
  CalculatePriceUseCase,
  ChangeDeliveryNoteStatusUseCase,
  CreateDeliveryNoteUseCase,
  DeleteDeliveryNoteUseCase,
  GetDashboardSummaryUseCase,
  GetDeliveryNoteUseCase,
  GetDeliveryNotesUseCase,
  SendDailyDeliveryNotesReportUseCase,
  UpdateDeliveryNoteUseCase
} from "../application/use-cases/deliveryNotes.js";
import type { GetCustomerUseCase } from "../application/use-cases/customers.js";
import {
  getDateQuery,
  getNonNegativeIntegerQuery,
  getPositiveIntegerQuery,
  getRouteParam,
  getStatusQuery
} from "./requestParsers.js";

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
    private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
    private readonly sendDailyDeliveryNotesReportUseCase: SendDailyDeliveryNotesReportUseCase
  ) {}

  public list = async (request: Request, response: Response) => {
    const filters = {
      date: getDateQuery(request.query.date),
      status: getStatusQuery(request.query.status),
      customerId: typeof request.query.customerId === "string" ? request.query.customerId : undefined,
      today: request.query.today === "true",
      limit: getPositiveIntegerQuery(request.query.limit),
      offset: getNonNegativeIntegerQuery(request.query.offset)
    };
    const deliveryNotes = await this.getDeliveryNotesUseCase.execute(filters);
    const total = await this.getDeliveryNotesUseCase.count({
      date: filters.date,
      status: filters.status,
      customerId: filters.customerId,
      today: filters.today
    });
    response.json({
      deliveryNotes,
      pagination: {
        total,
        limit: filters.limit ?? null,
        offset: filters.offset ?? 0,
        hasMore:
          typeof filters.limit === "number"
            ? (filters.offset ?? 0) + deliveryNotes.length < total
            : false
      }
    });
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

  public sendDailyReport = async (request: Request, response: Response) => {
    const result = await this.sendDailyDeliveryNotesReportUseCase.execute(request.body);
    response.json({
      message: "Archivo subido a Google Drive",
      result: {
        date: result.date.toISOString(),
        fileId: result.fileId,
        fileName: result.fileName,
        folderName: result.folderName,
        notesCount: result.notesCount,
        webViewLink: result.webViewLink
      }
    });
  };
}
