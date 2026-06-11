import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { AuthenticateWithGoogleUseCase } from "./application/use-cases/auth.js";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  GetCustomersUseCase,
  UpdateCustomerUseCase
} from "./application/use-cases/customers.js";
import {
  CalculatePriceUseCase,
  ChangeDeliveryNoteStatusUseCase,
  CreateDeliveryNoteUseCase,
  DeleteDeliveryNoteUseCase,
  GetDashboardSummaryUseCase,
  GetDeliveryNoteUseCase,
  GetDeliveryNotesUseCase,
  SendDailyDeliveryNotesReportUseCase,
  UpdateDeliveryNoteUseCase
} from "./application/use-cases/deliveryNotes.js";
import { CustomersController } from "./controllers/CustomersController.js";
import { DeliveryNotesController } from "./controllers/DeliveryNotesController.js";
import { PrismaCustomerRepository } from "./infrastructure/repositories/PrismaCustomerRepository.js";
import { PrismaDailyDeliveryNotesReportUploadRepository } from "./infrastructure/repositories/PrismaDailyDeliveryNotesReportUploadRepository.js";
import { PrismaDeliveryNoteRepository } from "./infrastructure/repositories/PrismaDeliveryNoteRepository.js";
import { DailyDeliveryNotesReportScheduler } from "./infrastructure/services/DailyDeliveryNotesReportScheduler.js";
import { GoogleIdTokenVerifier } from "./infrastructure/services/GoogleIdTokenVerifier.js";
import { JwtAccessTokenIssuer } from "./infrastructure/services/JwtAccessTokenIssuer.js";
import { PdfKitDailyDeliveryNotesReportGenerator } from "./infrastructure/services/PdfKitDailyDeliveryNotesReportGenerator.js";
import { RcloneDriveUploader } from "./infrastructure/services/RcloneDriveUploader.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { buildAuthRouter } from "./routes/auth.routes.js";
import { buildCustomersRouter } from "./routes/customers.routes.js";
import { buildDeliveryNotesRouter } from "./routes/deliveryNotes.routes.js";
import { buildHermesToolsRouter } from "./routes/hermesTools.routes.js";

const customerRepository = new PrismaCustomerRepository();
const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
const dailyReportUploadRepository = new PrismaDailyDeliveryNotesReportUploadRepository();
const calculatePriceUseCase = new CalculatePriceUseCase();

const getCustomersUseCase = new GetCustomersUseCase(customerRepository);
const getCustomerUseCase = new GetCustomerUseCase(customerRepository);
const createCustomerUseCase = new CreateCustomerUseCase(customerRepository);
const updateCustomerUseCase = new UpdateCustomerUseCase(customerRepository);
const deleteCustomerUseCase = new DeleteCustomerUseCase(customerRepository);

const getDeliveryNotesUseCase = new GetDeliveryNotesUseCase(deliveryNoteRepository);
const getDeliveryNoteUseCase = new GetDeliveryNoteUseCase(deliveryNoteRepository);
const createDeliveryNoteUseCase = new CreateDeliveryNoteUseCase(
  customerRepository,
  deliveryNoteRepository,
  calculatePriceUseCase
);
const updateDeliveryNoteUseCase = new UpdateDeliveryNoteUseCase(
  customerRepository,
  deliveryNoteRepository,
  calculatePriceUseCase
);
const deleteDeliveryNoteUseCase = new DeleteDeliveryNoteUseCase(deliveryNoteRepository);
const changeDeliveryNoteStatusUseCase = new ChangeDeliveryNoteStatusUseCase(deliveryNoteRepository);
const getDashboardSummaryUseCase = new GetDashboardSummaryUseCase(deliveryNoteRepository);
const reportGenerator = env.GOOGLE_DRIVE_ENABLED ? new PdfKitDailyDeliveryNotesReportGenerator() : null;
const reportUploader = env.GOOGLE_DRIVE_ENABLED
  ? new RcloneDriveUploader({
      rcloneRemote: env.RCLONE_REMOTE!,
      rcloneConfigPath: env.RCLONE_CONFIG_PATH!
    })
  : null;
const sendDailyDeliveryNotesReportUseCase = new SendDailyDeliveryNotesReportUseCase(
  customerRepository,
  deliveryNoteRepository,
  reportGenerator,
  reportUploader,
  dailyReportUploadRepository
);
const dailyDeliveryNotesReportScheduler = new DailyDeliveryNotesReportScheduler(
  sendDailyDeliveryNotesReportUseCase,
  {
    enabled: env.DAILY_REPORT_AUTOMATION_ENABLED,
    hour: env.DAILY_REPORT_AUTOMATION_HOUR,
    minute: env.DAILY_REPORT_AUTOMATION_MINUTE
  }
);
const authenticateWithGoogleUseCase = new AuthenticateWithGoogleUseCase(
  new GoogleIdTokenVerifier(env.GOOGLE_CLIENT_ID),
  new JwtAccessTokenIssuer(env.JWT_SECRET, env.JWT_EXPIRES_IN),
  env.ALLOWED_EMAILS
);

const customersController = new CustomersController(
  getCustomersUseCase,
  getCustomerUseCase,
  createCustomerUseCase,
  updateCustomerUseCase,
  deleteCustomerUseCase
);

const deliveryNotesController = new DeliveryNotesController(
  getDeliveryNotesUseCase,
  getDeliveryNoteUseCase,
  createDeliveryNoteUseCase,
  updateDeliveryNoteUseCase,
  deleteDeliveryNoteUseCase,
  changeDeliveryNoteStatusUseCase,
  calculatePriceUseCase,
  getCustomerUseCase,
  getDashboardSummaryUseCase,
  sendDailyDeliveryNotesReportUseCase
);

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map(o => o.trim()),
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", buildAuthRouter(authenticateWithGoogleUseCase));
app.use("/api", authMiddleware);
app.use("/api/customers", buildCustomersRouter(customersController));
app.use("/api/delivery-notes", buildDeliveryNotesRouter(deliveryNotesController));
app.get("/api/dashboard/summary", asyncHandler(deliveryNotesController.getDashboardSummary));
app.use("/api/hermes-tools", buildHermesToolsRouter(customersController, deliveryNotesController));

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on ${env.PORT}`);
  dailyDeliveryNotesReportScheduler.start();
});
