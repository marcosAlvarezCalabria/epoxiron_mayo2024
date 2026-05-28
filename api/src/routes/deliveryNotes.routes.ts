import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  calculatePriceSchema,
  deliveryNoteInputSchema,
  deliveryNoteStatusSchema
} from "../schemas/deliveryNoteSchemas.js";
import { DeliveryNotesController } from "../controllers/DeliveryNotesController.js";

export const buildDeliveryNotesRouter = (controller: DeliveryNotesController) => {
  const router = Router();

  router.get("/", asyncHandler(controller.list));
  router.post("/calculate-price", async (request, _response, next) => {
    try {
      request.body = calculatePriceSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.calculatePrice));
  router.get("/:id", asyncHandler(controller.getById));
  router.post("/", async (request, _response, next) => {
    try {
      request.body = deliveryNoteInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.create));
  router.put("/:id", async (request, _response, next) => {
    try {
      request.body = deliveryNoteInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.delete));
  router.patch("/:id/status", async (request, _response, next) => {
    try {
      request.body = deliveryNoteStatusSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.updateStatus));

  return router;
};
