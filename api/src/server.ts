import { env } from "./config/env.js";
import { createAppContext } from "./app.js";

const {
  app,
  dailyDeliveryNotesReportScheduler,
  invoiceReconciliationScheduler,
  telegramDeliveryNoteBot
} = createAppContext();

const server = app.listen(env.PORT, () => {
  console.log(`API listening on ${env.PORT}`);
  dailyDeliveryNotesReportScheduler.start();
  invoiceReconciliationScheduler.start();
  telegramDeliveryNoteBot?.start();
});

const shutdown = (): void => {
  dailyDeliveryNotesReportScheduler.stop();
  invoiceReconciliationScheduler.stop();
  telegramDeliveryNoteBot?.stop();
  server.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
