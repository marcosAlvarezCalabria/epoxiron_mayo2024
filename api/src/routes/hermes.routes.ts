import { Router } from "express";
import { HermesBridgeController } from "../controllers/HermesBridgeController.js";
import { hermesMessageSchema } from "../schemas/hermesSchemas.js";

export const buildHermesRouter = (controller: HermesBridgeController) => {
  const router = Router();

  router.post("/sessions", controller.createSession);
  router.get("/sessions/:id", controller.getSession);
  router.post("/sessions/:id/messages", async (request, _response, next) => {
    try {
      request.body = hermesMessageSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, controller.sendMessage);
  router.post("/proposals/:id/confirm", controller.confirmProposal);
  router.post("/proposals/:id/reject", controller.rejectProposal);
  router.get("/tasks", controller.listTasks);

  return router;
};
