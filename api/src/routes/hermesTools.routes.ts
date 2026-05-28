import { Router } from "express";
import { CustomersController } from "../controllers/CustomersController.js";
import { DeliveryNotesController } from "../controllers/DeliveryNotesController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireHermesSecret } from "../middleware/requireHermesSecret.js";
import { calculatePriceSchema, deliveryNoteInputSchema, deliveryNoteStatusSchema } from "../schemas/deliveryNoteSchemas.js";

export const buildHermesToolsRouter = (
  customersController: CustomersController,
  deliveryNotesController: DeliveryNotesController
) => {
  const router = Router();

  router.use(requireHermesSecret);

  router.get("/customers", asyncHandler(customersController.list));
  router.get("/customers/:id", asyncHandler(customersController.getById));
  router.get("/delivery-notes", asyncHandler(deliveryNotesController.list));
  router.get("/delivery-notes/:id", asyncHandler(deliveryNotesController.getById));
  router.post("/delivery-notes", async (request, _response, next) => {
    try {
      request.body = deliveryNoteInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(deliveryNotesController.create));
  router.patch("/delivery-notes/:id/status", async (request, _response, next) => {
    try {
      request.body = deliveryNoteStatusSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(deliveryNotesController.updateStatus));
  router.post("/calculate-price", async (request, _response, next) => {
    try {
      request.body = calculatePriceSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(deliveryNotesController.calculatePrice));
  router.get("/dashboard-summary", asyncHandler(deliveryNotesController.getDashboardSummary));

  return router;
};
