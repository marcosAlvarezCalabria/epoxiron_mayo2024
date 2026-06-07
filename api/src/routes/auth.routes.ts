import { Router } from "express";
import type { AuthenticateWithGoogleUseCase } from "../application/use-cases/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { googleLoginSchema } from "../schemas/authSchemas.js";

export const buildAuthRouter = (authenticateWithGoogleUseCase: AuthenticateWithGoogleUseCase) => {
  const router = Router();

  router.post("/login/google", async (request, _response, next) => {
    try {
      request.body = googleLoginSchema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  }, asyncHandler(async (request, response) => {
    const result = await authenticateWithGoogleUseCase.execute(request.body);

    response.json({
      token: result.token,
      email: result.user.email,
      name: result.user.name
    });
  }));

  return router;
};
