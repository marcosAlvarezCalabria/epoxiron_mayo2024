import { describe, expect, it, vi } from "vitest";
import { DailyDeliveryNotesReportScheduler } from "../src/infrastructure/services/DailyDeliveryNotesReportScheduler.js";

describe("daily delivery notes report scheduler", () => {
  it("runs the daily upload once after the configured time", async () => {
    const sendDailyDeliveryNotesReportUseCase = {
      execute: vi.fn(async () => ({
        date: new Date("2026-06-11T00:00:00.000Z"),
        fileId: "drive-file-1",
        fileName: "albaranes-2026-06-11.pdf",
        folderName: "2026-06",
        notesCount: 3,
        webViewLink: null
      }))
    };

    const scheduler = new DailyDeliveryNotesReportScheduler(
      sendDailyDeliveryNotesReportUseCase,
      {
        enabled: true,
        hour: 18,
        minute: 0
      }
    );

    await scheduler.tick(new Date(2026, 5, 11, 17, 59, 0, 0));
    await scheduler.tick(new Date(2026, 5, 11, 18, 0, 0, 0));
    await scheduler.tick(new Date(2026, 5, 11, 18, 5, 0, 0));

    expect(sendDailyDeliveryNotesReportUseCase.execute).toHaveBeenCalledTimes(1);
    expect(sendDailyDeliveryNotesReportUseCase.execute).toHaveBeenCalledWith({
      date: new Date(2026, 5, 11)
    });
  });

  it("does not run when automation is disabled", async () => {
    const sendDailyDeliveryNotesReportUseCase = {
      execute: vi.fn()
    };

    const scheduler = new DailyDeliveryNotesReportScheduler(
      sendDailyDeliveryNotesReportUseCase,
      {
        enabled: false,
        hour: 18,
        minute: 0
      }
    );

    await scheduler.tick(new Date(2026, 5, 11, 18, 0, 0, 0));

    expect(sendDailyDeliveryNotesReportUseCase.execute).not.toHaveBeenCalled();
  });
});
