interface DailyDeliveryNotesReportExecutor {
  execute(input: { date?: Date }): Promise<{
    date: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
  }>;
}

interface DailyDeliveryNotesReportSchedulerConfig {
  hour: number;
  minute: number;
  enabled: boolean;
}

const buildDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const atStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export class DailyDeliveryNotesReportScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  private lastAttemptedDayKey: string | null = null;

  public constructor(
    private readonly sendDailyDeliveryNotesReportUseCase: DailyDeliveryNotesReportExecutor,
    private readonly config: DailyDeliveryNotesReportSchedulerConfig
  ) {}

  public start() {
    if (!this.config.enabled || this.intervalId) {
      return;
    }

    void this.tick();
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 60_000);
  }

  public stop() {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  public async tick(referenceDate = new Date()) {
    if (!this.config.enabled) {
      return;
    }

    const scheduledAt = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      this.config.hour,
      this.config.minute,
      0,
      0
    );

    if (referenceDate < scheduledAt) {
      return;
    }

    const dayKey = buildDayKey(referenceDate);
    if (this.lastAttemptedDayKey === dayKey) {
      return;
    }

    this.lastAttemptedDayKey = dayKey;

    try {
      const result = await this.sendDailyDeliveryNotesReportUseCase.execute({
        date: atStartOfDay(referenceDate)
      });
      console.log(
        `[daily-report-scheduler] reporte diario procesado para ${dayKey}: ${result.fileName}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[daily-report-scheduler] fallo procesando ${dayKey}: ${message}`);
    }
  }
}
