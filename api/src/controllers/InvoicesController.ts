import type { Request, Response } from "express";
import type { CreateInvoiceFromDeliveryNotesUseCase } from "../application/use-cases/invoices/createInvoiceFromDeliveryNotes.js";
import type { GetInvoiceUseCase } from "../application/use-cases/invoices/getInvoice.js";
import type { GetInvoicePdfUseCase } from "../application/use-cases/invoices/getInvoicePdf.js";
import type { ListInvoicesUseCase } from "../application/use-cases/invoices/listInvoices.js";
import type { ReconcileInvoiceUseCase } from "../application/use-cases/invoices/reconcileInvoice.js";
import { listInvoicesQuerySchema } from "../schemas/invoiceSchemas.js";
import { getRouteParam } from "./requestParsers.js";

const safePdfFileName = (number: string | null, id: string): string => {
  const base = number ?? `factura-${id}`;
  return `${base.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;
};

export class InvoicesController {
  public constructor(
    private readonly createInvoiceUseCase: CreateInvoiceFromDeliveryNotesUseCase,
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    private readonly reconcileInvoiceUseCase: ReconcileInvoiceUseCase,
    private readonly getInvoicePdfUseCase: GetInvoicePdfUseCase
  ) {}

  public create = async (request: Request, response: Response) => {
    const result = await this.createInvoiceUseCase.executeWithResult(request.body.deliveryNoteIds);
    response.status(result.created ? 201 : 200).json(result);
  };

  public list = async (request: Request, response: Response) => {
    const filters = listInvoicesQuerySchema.parse(request.query);
    response.json(await this.listInvoicesUseCase.execute(filters));
  };

  public getById = async (request: Request, response: Response) => {
    const invoice = await this.getInvoiceUseCase.execute(getRouteParam(request.params.id));
    response.json({ invoice });
  };

  public reconcile = async (request: Request, response: Response) => {
    const invoice = await this.reconcileInvoiceUseCase.execute(getRouteParam(request.params.id));
    response.json({ invoice });
  };

  public pdf = async (request: Request, response: Response) => {
    const result = await this.getInvoicePdfUseCase.execute(getRouteParam(request.params.id));
    response
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safePdfFileName(result.invoice.number, result.invoice.id)}"`,
        "Cache-Control": "private, no-store",
        "Content-Length": result.pdf.length.toString()
      })
      .send(result.pdf);
  };
}
