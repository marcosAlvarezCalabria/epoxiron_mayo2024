import { Router } from "express";
import type { InvoicesController } from "../controllers/InvoicesController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createInvoiceSchema, previewInvoiceSchema } from "../schemas/invoiceSchemas.js";

export const buildInvoicesRouter = (controller: InvoicesController) => {
  const router = Router();

  router.get("/", asyncHandler(controller.list));
  router.post("/preview", (request, _response, next) => {
    try {
      request.body = previewInvoiceSchema.parse(request.body);
      next();
    } catch (error: unknown) {
      next(error);
    }
  }, asyncHandler(controller.preview));
  router.post("/", (request, _response, next) => {
    try {
      request.body = createInvoiceSchema.parse(request.body);
      next();
    } catch (error: unknown) {
      next(error);
    }
  }, asyncHandler(controller.create));
  router.get("/:id", asyncHandler(controller.getById));
  router.post("/:id/reconcile", asyncHandler(controller.reconcile));
  router.get("/:id/pdf", asyncHandler(controller.pdf));

  return router;
};
