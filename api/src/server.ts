import { env } from "./config/env.js";
import { createAppContext } from "./app.js";

const { app, dailyDeliveryNotesReportScheduler } = createAppContext();

app.listen(env.PORT, () => {
  console.log(`API listening on ${env.PORT}`);
  dailyDeliveryNotesReportScheduler.start();
});
