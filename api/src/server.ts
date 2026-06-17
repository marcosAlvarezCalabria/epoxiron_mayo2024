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
  GetDailyDeliveryNotesReportUploadsUseCase,
  GetDashboardSummaryUseCase,
  GetDeliveryNoteUseCase,
  GetDeliveryNotesUseCase,
  SendDailyDeliveryNotesReportUseCase,
  UpdateDeliveryNoteUseCase
} from "./application/use-cases/deliveryNotes.js";
import { ParseVoiceAlbaranUseCase } from "./application/use-cases/parseVoiceAlbaran.js";
import { ParseVoiceAlbaranAudioUseCase } from "./application/use-cases/parseVoiceAlbaranAudio.js";
import { CustomersController } from "./controllers/CustomersController.js";
import { DeliveryNotesController } from "./controllers/DeliveryNotesController.js";
import { VoiceController } from "./controllers/VoiceController.js";
import { PrismaCustomerRepository } from "./infrastructure/repositories/PrismaCustomerRepository.js";
import { PrismaDailyDeliveryNotesReportUploadRepository } from "./infrastructure/repositories/PrismaDailyDeliveryNotesReportUploadRepository.js";
import { PrismaDeliveryNoteRepository } from "./infrastructure/repositories/PrismaDeliveryNoteRepository.js";
import { DailyDeliveryNotesReportScheduler } from "./infrastructure/services/DailyDeliveryNotesReportScheduler.js";
import { GoogleIdTokenVerifier } from "./infrastructure/services/GoogleIdTokenVerifier.js";
import { GeminiVoiceTranscriber } from "./infrastructure/services/GeminiVoiceTranscriber.js";
import { JwtAccessTokenIssuer } from "./infrastructure/services/JwtAccessTokenIssuer.js";
import { NodemailerEmailNotifier } from "./infrastructure/services/NodemailerEmailNotifier.js";
import { OllamaVoiceTranscriber } from "./infrastructure/services/OllamaVoiceTranscriber.js";
import { PdfKitDailyDeliveryNotesReportGenerator } from "./infrastructure/services/PdfKitDailyDeliveryNotesReportGenerator.js";
import { R2DriveUploader } from "./infrastructure/services/R2DriveUploader.js";
import { OpenAiVoiceTranscriber } from "./infrastructure/services/OpenAiVoiceTranscriber.js";
import { createVoiceAlbaranParser } from "./infrastructure/services/VoiceAlbaranParserFactory.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { buildAuthRouter } from "./routes/auth.routes.js";
import { buildCustomersRouter } from "./routes/customers.routes.js";
import { buildDeliveryNotesRouter } from "./routes/deliveryNotes.routes.js";
import { buildHermesToolsRouter } from "./routes/hermesTools.routes.js";
import { buildVoiceRouter } from "./routes/voice.routes.js";

const customerRepository = new PrismaCustomerRepository();
const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
const dailyReportUploadRepository = new PrismaDailyDeliveryNotesReportUploadRepository();
const emailNotifier = new NodemailerEmailNotifier({
  enabled: env.EMAIL_NOTIFICATIONS_ENABLED,
  from: env.EMAIL_FROM,
  to: env.EMAIL_TO,
  appPassword: env.EMAIL_APP_PASSWORD
});
const calculatePriceUseCase = new CalculatePriceUseCase();
const voiceAlbaranParser = createVoiceAlbaranParser({
  apiKey: env.VOICE_PARSER_API_KEY,
  baseUrl: env.VOICE_PARSER_BASE_URL!,
  model: env.VOICE_PARSER_MODEL!,
  provider: env.VOICE_PARSER_PROVIDER,
  timeoutMs: env.VOICE_PARSER_TIMEOUT_MS!
});
const voiceTranscriber =
  env.VOICE_TRANSCRIBER_PROVIDER === "ollama"
    ? new OllamaVoiceTranscriber({
        apiKey: env.VOICE_TRANSCRIBER_API_KEY!,
        baseUrl: env.VOICE_TRANSCRIBER_BASE_URL!,
        model: env.VOICE_TRANSCRIBER_MODEL!,
        timeoutMs: env.VOICE_TRANSCRIBER_TIMEOUT_MS!
      })
    : env.VOICE_TRANSCRIBER_PROVIDER === "gemini"
      ? new GeminiVoiceTranscriber({
          apiKey: env.VOICE_TRANSCRIBER_API_KEY!,
          baseUrl: env.VOICE_TRANSCRIBER_BASE_URL!,
          model: env.VOICE_TRANSCRIBER_MODEL!,
          language: env.VOICE_TRANSCRIBER_LANGUAGE,
          timeoutMs: env.VOICE_TRANSCRIBER_TIMEOUT_MS!
        })
    : new OpenAiVoiceTranscriber({
        apiKey: env.VOICE_TRANSCRIBER_API_KEY!,
        baseUrl: env.VOICE_TRANSCRIBER_BASE_URL!,
        model: env.VOICE_TRANSCRIBER_MODEL!,
        language: env.VOICE_TRANSCRIBER_LANGUAGE,
        timeoutMs: env.VOICE_TRANSCRIBER_TIMEOUT_MS!
      });

const getCustomersUseCase = new GetCustomersUseCase(customerRepository);
const getCustomerUseCase = new GetCustomerUseCase(customerRepository);
const createCustomerUseCase = new CreateCustomerUseCase(customerRepository);
const updateCustomerUseCase = new UpdateCustomerUseCase(customerRepository);
const deleteCustomerUseCase = new DeleteCustomerUseCase(customerRepository);

const getDeliveryNotesUseCase = new GetDeliveryNotesUseCase(deliveryNoteRepository);
const getDeliveryNoteUseCase = new GetDeliveryNoteUseCase(deliveryNoteRepository);
const getDailyDeliveryNotesReportUploadsUseCase = new GetDailyDeliveryNotesReportUploadsUseCase(
  dailyReportUploadRepository
);
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
const reportGenerator = env.REPORT_UPLOADS_ENABLED ? new PdfKitDailyDeliveryNotesReportGenerator() : null;
const reportUploader = env.REPORT_UPLOADS_ENABLED
  ? new R2DriveUploader({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucketName: env.R2_BUCKET_NAME!,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL!
    })
  : null;
const sendDailyDeliveryNotesReportUseCase = new SendDailyDeliveryNotesReportUseCase(
  customerRepository,
  deliveryNoteRepository,
  reportGenerator,
  reportUploader,
  dailyReportUploadRepository,
  emailNotifier
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
const parseVoiceAlbaranUseCase = new ParseVoiceAlbaranUseCase(voiceAlbaranParser, customerRepository);
const parseVoiceAlbaranAudioUseCase = new ParseVoiceAlbaranAudioUseCase(
  voiceTranscriber,
  parseVoiceAlbaranUseCase
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
  getDailyDeliveryNotesReportUploadsUseCase,
  getDashboardSummaryUseCase,
  sendDailyDeliveryNotesReportUseCase
);
const voiceController = new VoiceController(parseVoiceAlbaranUseCase, parseVoiceAlbaranAudioUseCase);

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
app.use("/api/voice", buildVoiceRouter(voiceController));
app.get("/api/dashboard/summary", asyncHandler(deliveryNotesController.getDashboardSummary));
app.use("/api/hermes-tools", buildHermesToolsRouter(customersController, deliveryNotesController));

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on ${env.PORT}`);
  dailyDeliveryNotesReportScheduler.start();
});
