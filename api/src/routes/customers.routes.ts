import { Router } from "express";
import { customerInputSchema } from "../schemas/customerSchemas.js";
import { CustomersController } from "../controllers/CustomersController.js";

export const buildCustomersRouter = (controller: CustomersController) => {
  const router = Router();

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post("/", async (request, _response, next) => {
    try {
      request.body = customerInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.create);
  router.put("/:id", async (request, _response, next) => {
    try {
      request.body = customerInputSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.update);
  router.delete("/:id", controller.delete);

  return router;
};
