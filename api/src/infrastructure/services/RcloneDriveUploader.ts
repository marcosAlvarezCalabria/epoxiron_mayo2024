import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { ReportAttachment } from "../../domain/services/DailyDeliveryNotesReportGenerator.js";
import type {
  DailyDeliveryNotesReportUploader,
  DailyDeliveryNotesReportUploadResult
} from "../../domain/services/DailyDeliveryNotesReportUploader.js";

const execFileAsync = promisify(execFile);

interface RcloneDriveUploaderConfig {
  rcloneRemote: string;
  rcloneConfigPath: string;
}

const buildMonthFolderName = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildDailyFileName = (date: Date) =>
  `albaranes-${date.toISOString().slice(0, 10)}.pdf`;

export class RcloneDriveUploader implements DailyDeliveryNotesReportUploader {
  public constructor(private readonly config: RcloneDriveUploaderConfig) {}

  public async upload(input: {
    attachment: ReportAttachment;
    date: Date;
  }): Promise<DailyDeliveryNotesReportUploadResult> {
    const folderName = buildMonthFolderName(input.date);
    const fileName = buildDailyFileName(input.date);
    const remotePath = `${this.config.rcloneRemote}/${folderName}/${fileName}`;
    const tmpPath = join(tmpdir(), `epoxiron-${randomUUID()}.pdf`);

    await writeFile(tmpPath, input.attachment.content);

    try {
      await execFileAsync("rclone", [
        "copyto",
        tmpPath,
        remotePath,
        "--config",
        this.config.rcloneConfigPath
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DomainException(`rclone upload fallo: ${message}`, 502);
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }

    return {
      fileId: remotePath,
      fileName,
      folderName,
      webViewLink: null
    };
  }
}
