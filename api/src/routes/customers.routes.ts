import { Router } from "express";
import { customerInputSchema } from "../schemas/customerSchemas.js";
import { CustomersController } from "../controllers/CustomersController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const buildCustomersRouter = (controller: CustomersController) => {
  const router = Router();

  router.get("/", asyncHandler(controller.list));
  router.get("/:id", asyncHandler(controller.getById));
  router.post("/", async (request, _response, next) => {
    try {
      request.body = customerInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.create));
  router.put("/:id", async (request, _response, next) => {
    try {
      request.body = customerInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.delete));

  return router;
};
