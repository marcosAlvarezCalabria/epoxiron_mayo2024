import { Router } from "express";
import {
  calculatePriceSchema,
  deliveryNoteInputSchema,
  deliveryNoteStatusSchema
} from "../schemas/deliveryNoteSchemas.js";
import { DeliveryNotesController } from "../controllers/DeliveryNotesController.js";

export const buildDeliveryNotesRouter = (controller: DeliveryNotesController) => {
  const router = Router();

  router.get("/", controller.list);
  router.post("/calculate-price", async (request, _response, next) => {
    try {
      request.body = calculatePriceSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.calculatePrice);
  router.get("/:id", controller.getById);
  router.post("/", async (request, _response, next) => {
    try {
      request.body = deliveryNoteInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.create);
  router.put("/:id", async (request, _response, next) => {
    try {
      request.body = deliveryNoteInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.update);
  router.delete("/:id", controller.delete);
  router.patch("/:id/status", async (request, _response, next) => {
    try {
      request.body = deliveryNoteStatusSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.updateStatus);

  return router;
};
