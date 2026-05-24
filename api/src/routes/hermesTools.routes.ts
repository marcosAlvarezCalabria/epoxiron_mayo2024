import { Router } from "express";
import { CustomersController } from "../controllers/CustomersController.js";
import { DeliveryNotesController } from "../controllers/DeliveryNotesController.js";
import { requireHermesSecret } from "../middleware/requireHermesSecret.js";
import { calculatePriceSchema, deliveryNoteInputSchema, deliveryNoteStatusSchema } from "../schemas/deliveryNoteSchemas.js";

export const buildHermesToolsRouter = (
  customersController: CustomersController,
  deliveryNotesController: DeliveryNotesController
) => {
  const router = Router();

  router.use(requireHermesSecret);

  router.get("/customers", customersController.list);
  router.get("/customers/:id", customersController.getById);
  router.get("/delivery-notes", deliveryNotesController.list);
  router.get("/delivery-notes/:id", deliveryNotesController.getById);
  router.post("/delivery-notes", async (request, _response, next) => {
    try {
      request.body = deliveryNoteInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, deliveryNotesController.create);
  router.patch("/delivery-notes/:id/status", async (request, _response, next) => {
    try {
      request.body = deliveryNoteStatusSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, deliveryNotesController.updateStatus);
  router.post("/calculate-price", async (request, _response, next) => {
    try {
      request.body = calculatePriceSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, deliveryNotesController.calculatePrice);
  router.get("/dashboard-summary", deliveryNotesController.getDashboardSummary);

  return router;
};

