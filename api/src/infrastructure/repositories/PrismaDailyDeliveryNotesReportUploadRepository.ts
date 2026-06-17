import type { DailyDeliveryNotesReportUpload } from "../../domain/entities/DailyDeliveryNotesReportUpload.js";
import type { DailyDeliveryNotesReportUploadRepository } from "../../domain/repositories/DailyDeliveryNotesReportUploadRepository.js";
import { prisma } from "../prisma/client.js";

const normalizeReportDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toDomainUpload = (upload: {
  id: string;
  reportDate: Date;
  fileId: string;
  fileName: string;
  folderName: string;
  notesCount: number;
  webViewLink: string | null;
  createdAt: Date;
}): DailyDeliveryNotesReportUpload => ({
  ...upload
});

type DailyDeliveryNotesReportUploadDelegate = {
  findUnique(args: {
    where: {
      reportDate: Date;
    };
  }): Promise<{
    id: string;
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    createdAt: Date;
  } | null>;
  create(args: {
    data: {
      reportDate: Date;
      fileId: string;
      fileName: string;
      folderName: string;
      notesCount: number;
      webViewLink: string | null;
    };
  }): Promise<{
    id: string;
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    createdAt: Date;
  }>;
  update(args: {
    where: {
      reportDate: Date;
    };
    data: {
      fileId: string;
      fileName: string;
      folderName: string;
      notesCount: number;
      webViewLink: string | null;
    };
  }): Promise<{
    id: string;
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    createdAt: Date;
  }>;
};

const dailyDeliveryNotesReportUploadDelegate = (
  prisma as unknown as {
    dailyDeliveryNotesReportUpload: DailyDeliveryNotesReportUploadDelegate;
  }
).dailyDeliveryNotesReportUpload;

export class PrismaDailyDeliveryNotesReportUploadRepository
  implements DailyDeliveryNotesReportUploadRepository
{
  public async findByDate(reportDate: Date) {
    const upload = await dailyDeliveryNotesReportUploadDelegate.findUnique({
      where: {
        reportDate: normalizeReportDate(reportDate)
      }
    });

    return upload ? toDomainUpload(upload) : null;
  }

  public async create(input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
  }) {
    const upload = await dailyDeliveryNotesReportUploadDelegate.create({
      data: {
        ...input,
        reportDate: normalizeReportDate(input.reportDate)
      }
    });

    return toDomainUpload(upload);
  }

  public async updateByDate(input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
  }) {
    const upload = await dailyDeliveryNotesReportUploadDelegate.update({
      where: {
        reportDate: normalizeReportDate(input.reportDate)
      },
      data: {
        fileId: input.fileId,
        fileName: input.fileName,
        folderName: input.folderName,
        notesCount: input.notesCount,
        webViewLink: input.webViewLink
      }
    });

    return toDomainUpload(upload);
  }
}
