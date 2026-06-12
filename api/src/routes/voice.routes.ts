import { Router } from "express";
import { VoiceController } from "../controllers/VoiceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parseVoiceAlbaranRequestSchema } from "../schemas/voiceSchemas.js";

export const buildVoiceRouter = (controller: VoiceController) => {
  const router = Router();

  router.post("/parse-albaran", async (request, _response, next) => {
    try {
      request.body = parseVoiceAlbaranRequestSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.parseAlbaran));

  return router;
};
