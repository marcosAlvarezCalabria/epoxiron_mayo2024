import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
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
  UpdateDeliveryNoteUseCase
} from "./application/use-cases/deliveryNotes.js";
import { CustomersController } from "./controllers/CustomersController.js";
import { DeliveryNotesController } from "./controllers/DeliveryNotesController.js";
import { PrismaCustomerRepository } from "./infrastructure/repositories/PrismaCustomerRepository.js";
import { PrismaDeliveryNoteRepository } from "./infrastructure/repositories/PrismaDeliveryNoteRepository.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { buildCustomersRouter } from "./routes/customers.routes.js";
import { buildDeliveryNotesRouter } from "./routes/deliveryNotes.routes.js";
import { buildHermesToolsRouter } from "./routes/hermesTools.routes.js";

const customerRepository = new PrismaCustomerRepository();
const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
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
  getDashboardSummaryUseCase
);

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/customers", buildCustomersRouter(customersController));
app.use("/api/delivery-notes", buildDeliveryNotesRouter(deliveryNotesController));
app.get("/api/dashboard/summary", asyncHandler(deliveryNotesController.getDashboardSummary));
app.use("/api/hermes-tools", buildHermesToolsRouter(customersController, deliveryNotesController));

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on ${env.PORT}`);
});
