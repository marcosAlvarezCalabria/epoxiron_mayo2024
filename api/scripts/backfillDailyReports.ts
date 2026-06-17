import {
  BackfillDailyDeliveryNotesReportsUseCase,
  SendDailyDeliveryNotesReportUseCase
} from "../src/application/use-cases/deliveryNotes.js";
import { env } from "../src/config/env.js";
import { PrismaCustomerRepository } from "../src/infrastructure/repositories/PrismaCustomerRepository.js";
import { PrismaDailyDeliveryNotesReportUploadRepository } from "../src/infrastructure/repositories/PrismaDailyDeliveryNotesReportUploadRepository.js";
import { PrismaDeliveryNoteRepository } from "../src/infrastructure/repositories/PrismaDeliveryNoteRepository.js";
import { NodemailerEmailNotifier } from "../src/infrastructure/services/NodemailerEmailNotifier.js";
import { PdfKitDailyDeliveryNotesReportGenerator } from "../src/infrastructure/services/PdfKitDailyDeliveryNotesReportGenerator.js";
import { prisma } from "../src/infrastructure/prisma/client.js";
import { R2DriveUploader } from "../src/infrastructure/services/R2DriveUploader.js";

const usage = [
  "Uso:",
  "  pnpm --filter @epoxiron/api reports:backfill -- --from 2026-01-01 --to 2026-06-17 [--dry-run]",
  "",
  "Opciones:",
  "  --from YYYY-MM-DD   Fecha inicial inclusive",
  "  --to YYYY-MM-DD     Fecha final inclusive",
  "  --dry-run           No sube PDFs; solo informa de los dias detectados",
  "  --help              Muestra esta ayuda"
].join("\n");

const parseIsoDateOnly = (value: string, optionName: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${optionName} debe tener formato YYYY-MM-DD`);
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${optionName} no es una fecha valida`);
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const readOption = (args: string[], name: "--from" | "--to") => {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
};

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const buildUseCases = () => {
  const customerRepository = new PrismaCustomerRepository();
  const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
  const uploadRepository = new PrismaDailyDeliveryNotesReportUploadRepository();
  const emailNotifier = new NodemailerEmailNotifier({
    enabled: env.EMAIL_NOTIFICATIONS_ENABLED,
    from: env.EMAIL_FROM,
    to: env.EMAIL_TO,
    appPassword: env.EMAIL_APP_PASSWORD
  });
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
    uploadRepository,
    emailNotifier
  );

  return {
    backfillUseCase: new BackfillDailyDeliveryNotesReportsUseCase(
      deliveryNoteRepository,
      sendDailyDeliveryNotesReportUseCase
    )
  };
};

const run = async () => {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(usage);
    return;
  }

  const fromValue = readOption(args, "--from");
  const toValue = readOption(args, "--to");
  const dryRun = args.includes("--dry-run");

  if (!fromValue || !toValue) {
    throw new Error("Debes indicar --from y --to");
  }

  if (!dryRun && !env.REPORT_UPLOADS_ENABLED) {
    throw new Error("REPORT_UPLOADS_ENABLED debe ser true para ejecutar el backfill real");
  }

  const from = parseIsoDateOnly(fromValue, "--from");
  const to = parseIsoDateOnly(toValue, "--to");

  const { backfillUseCase } = buildUseCases();
  const result = await backfillUseCase.execute({
    from,
    to,
    dryRun
  });

  console.log(
    `[backfill] rango=${formatDate(result.from)}..${formatDate(result.to)} dryRun=${result.dryRun}`
  );

  result.items.forEach((item) => {
    if (item.status === "dry-run") {
      console.log(
        `[backfill] ${formatDate(item.date)} status=dry-run notes=${item.notesCount}`
      );
      return;
    }

    if (item.status === "uploaded") {
      console.log(
        `[backfill] ${formatDate(item.date)} status=uploaded notes=${item.notesCount} file=${item.fileId}`
      );
      return;
    }

    console.error(
      `[backfill] ${formatDate(item.date)} status=failed notes=${item.notesCount} error=${item.errorMessage}`
    );
  });

  console.log(
    `[backfill] resumen dias=${result.processedDates} subidos=${result.uploadedDates} fallidos=${result.failedDates} albaranes=${result.totalNotes}`
  );

  if (result.failedDates > 0) {
    process.exitCode = 1;
  }
};

run()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error(`[backfill] fatal: ${message}`);
    console.error(usage);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
