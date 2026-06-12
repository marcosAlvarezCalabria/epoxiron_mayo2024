import { Router } from "express";
import multer from "multer";
import { VoiceController } from "../controllers/VoiceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { parseVoiceAlbaranRequestSchema } from "../schemas/voiceSchemas.js";

export const buildVoiceRouter = (controller: VoiceController) => {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024
    }
  });

  router.post("/parse-albaran", async (request, _response, next) => {
    try {
      request.body = parseVoiceAlbaranRequestSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(controller.parseAlbaran));

  router.post(
    "/parse-albaran-audio",
    upload.single("audio"),
    asyncHandler(controller.parseAlbaranAudio)
  );

  return router;
};
