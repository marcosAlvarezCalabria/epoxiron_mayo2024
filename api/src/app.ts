import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { AuthenticateWithGoogleUseCase } from "./application/use-cases/auth.js";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  GetCustomersUseCase,
  RestoreCustomerUseCase,
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
import { env } from "./config/env.js";
import { CustomersController } from "./controllers/CustomersController.js";
import { DeliveryNotesController } from "./controllers/DeliveryNotesController.js";
import { VoiceController } from "./controllers/VoiceController.js";
import { buildOpenApiDocument } from "./docs/openapi.js";
import { PrismaCustomerRepository } from "./infrastructure/repositories/PrismaCustomerRepository.js";
import { PrismaDailyDeliveryNotesReportUploadRepository } from "./infrastructure/repositories/PrismaDailyDeliveryNotesReportUploadRepository.js";
import { PrismaDeliveryNoteRepository } from "./infrastructure/repositories/PrismaDeliveryNoteRepository.js";
import { PrismaInvoiceRepository } from "./infrastructure/repositories/PrismaInvoiceRepository.js";
import { DailyDeliveryNotesReportScheduler } from "./infrastructure/services/DailyDeliveryNotesReportScheduler.js";
import { InvoiceReconciliationScheduler } from "./infrastructure/services/InvoiceReconciliationScheduler.js";
import { OdooJson2InvoiceGateway } from "./infrastructure/services/OdooJson2InvoiceGateway.js";
import { ReconcileInvoiceUseCase } from "./application/use-cases/invoices/reconcileInvoice.js";
import { CreateInvoiceFromDeliveryNotesUseCase } from "./application/use-cases/invoices/createInvoiceFromDeliveryNotes.js";
import { GetInvoiceUseCase } from "./application/use-cases/invoices/getInvoice.js";
import { GetInvoicePdfUseCase } from "./application/use-cases/invoices/getInvoicePdf.js";
import { ListInvoicesUseCase } from "./application/use-cases/invoices/listInvoices.js";
import { InvoicesController } from "./controllers/InvoicesController.js";
import { GeminiVoiceTranscriber } from "./infrastructure/services/GeminiVoiceTranscriber.js";
import { GoogleIdTokenVerifier } from "./infrastructure/services/GoogleIdTokenVerifier.js";
import { JwtAccessTokenIssuer } from "./infrastructure/services/JwtAccessTokenIssuer.js";
import { NodemailerEmailNotifier } from "./infrastructure/services/NodemailerEmailNotifier.js";
import { OllamaVoiceTranscriber } from "./infrastructure/services/OllamaVoiceTranscriber.js";
import { OpenAiVoiceTranscriber } from "./infrastructure/services/OpenAiVoiceTranscriber.js";
import { PdfKitDailyDeliveryNotesReportGenerator } from "./infrastructure/services/PdfKitDailyDeliveryNotesReportGenerator.js";
import { R2DriveUploader } from "./infrastructure/services/R2DriveUploader.js";
import { createVoiceAlbaranParser } from "./infrastructure/services/VoiceAlbaranParserFactory.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  buildGeneralApiRateLimiter,
  buildLoginRateLimiter
} from "./middleware/rateLimiters.js";
import { buildAuthRouter } from "./routes/auth.routes.js";
import { buildCustomersRouter } from "./routes/customers.routes.js";
import { buildDeliveryNotesRouter } from "./routes/deliveryNotes.routes.js";
import { buildHermesToolsRouter } from "./routes/hermesTools.routes.js";
import { buildVoiceRouter } from "./routes/voice.routes.js";
import { buildInvoicesRouter } from "./routes/invoices.routes.js";

export interface AppContext {
  app: express.Express;
  dailyDeliveryNotesReportScheduler: DailyDeliveryNotesReportScheduler;
  invoiceReconciliationScheduler: InvoiceReconciliationScheduler;
}

export const createAppContext = (): AppContext => {
  const customerRepository = new PrismaCustomerRepository();
  const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
  const dailyReportUploadRepository = new PrismaDailyDeliveryNotesReportUploadRepository();
  const invoiceRepository = new PrismaInvoiceRepository();
  const invoiceGateway = new OdooJson2InvoiceGateway({
    url: env.ODOO_URL,
    database: env.ODOO_DB,
    apiKey: env.ODOO_API_KEY,
    timeoutMs: env.ODOO_TIMEOUT_MS,
    taxRate: env.ODOO_TAX_RATE.toString(),
    taxId: env.ODOO_TAX_ID ?? null,
    maxPdfBytes: env.ODOO_MAX_PDF_BYTES
  });
  const reconcileInvoiceUseCase = new ReconcileInvoiceUseCase(
    invoiceRepository,
    invoiceGateway,
    env.ODOO_RECONCILIATION_MAX_ATTEMPTS
  );
  const createInvoiceUseCase = new CreateInvoiceFromDeliveryNotesUseCase(
    invoiceRepository,
    invoiceGateway,
    {
      enabled: env.ODOO_INVOICING_ENABLED,
      taxRate: env.ODOO_TAX_RATE.toString(),
      series: env.ODOO_SERIES.trim() || null
    }
  );
  const getInvoiceUseCase = new GetInvoiceUseCase(invoiceRepository);
  const listInvoicesUseCase = new ListInvoicesUseCase(invoiceRepository);
  const getInvoicePdfUseCase = new GetInvoicePdfUseCase(invoiceRepository, invoiceGateway);
  const invoiceReconciliationScheduler = new InvoiceReconciliationScheduler(
    invoiceRepository,
    reconcileInvoiceUseCase,
    {
      enabled: env.ODOO_RECONCILIATION_ENABLED,
      intervalMs: env.ODOO_RECONCILIATION_INTERVAL_MS,
      batchSize: 20
    }
  );
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
  const customerSyncConfig = { enabled: env.ODOO_CUSTOMER_SYNC_ENABLED };
  const createCustomerUseCase = new CreateCustomerUseCase(
    customerRepository,
    invoiceGateway,
    customerSyncConfig
  );
  const updateCustomerUseCase = new UpdateCustomerUseCase(
    customerRepository,
    invoiceGateway,
    customerSyncConfig
  );
  const deleteCustomerUseCase = new DeleteCustomerUseCase(
    customerRepository,
    invoiceGateway,
    customerSyncConfig
  );
  const restoreCustomerUseCase = new RestoreCustomerUseCase(
    customerRepository,
    invoiceGateway,
    customerSyncConfig
  );

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
    deleteCustomerUseCase,
    restoreCustomerUseCase
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
  const invoicesController = new InvoicesController(
    createInvoiceUseCase,
    getInvoiceUseCase,
    listInvoicesUseCase,
    reconcileInvoiceUseCase,
    getInvoicePdfUseCase
  );

  const app = express();

  // Produccion y staging reciben trafico publico a traves de un unico proxy Nginx.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true
    })
  );
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(
    "/api",
    buildGeneralApiRateLimiter({
      windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      max: env.API_RATE_LIMIT_MAX,
      hermesSharedSecret: env.HERMES_SHARED_SECRET
    })
  );

  if (env.NODE_ENV !== "production") {
    const openApiDocument = buildOpenApiDocument();

    app.get("/api/docs.json", (_request, response) => {
      response.json(openApiDocument);
    });
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  }

  app.use(
    "/api/auth",
    buildLoginRateLimiter({
      windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
      max: env.LOGIN_RATE_LIMIT_MAX
    }),
    buildAuthRouter(authenticateWithGoogleUseCase)
  );
  app.use("/api", authMiddleware);
  app.use("/api/customers", buildCustomersRouter(customersController));
  app.use("/api/delivery-notes", buildDeliveryNotesRouter(deliveryNotesController));
  app.use("/api/invoices", buildInvoicesRouter(invoicesController));
  app.use("/api/voice", buildVoiceRouter(voiceController));
  app.get("/api/dashboard/summary", asyncHandler(deliveryNotesController.getDashboardSummary));
  app.use("/api/hermes-tools", buildHermesToolsRouter(customersController, deliveryNotesController));

  app.use(errorHandler);

  return {
    app,
    dailyDeliveryNotesReportScheduler,
    invoiceReconciliationScheduler
  };
};

export const createApp = (): express.Express => createAppContext().app;
