import type { DailyDeliveryNotesReportUpload } from "../../domain/entities/DailyDeliveryNotesReportUpload.js";
import type { DailyDeliveryNotesReportUploadRepository } from "../../domain/repositories/DailyDeliveryNotesReportUploadRepository.js";
import { prisma } from "../prisma/client.js";

const normalizeReportDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const buildWhere = (filters: {
  dateFrom?: Date;
  dateTo?: Date;
}) => {
  const start = filters.dateFrom ? normalizeReportDate(filters.dateFrom) : undefined;
  const endExclusive = filters.dateTo ? addDays(normalizeReportDate(filters.dateTo), 1) : undefined;

  if (!start && !endExclusive) {
    return {};
  }

  return {
    reportDate: {
      gte: start,
      lt: endExclusive
    }
  };
};

const toDomainUpload = (upload: {
  id: string;
  reportDate: Date;
  fileId: string;
  fileName: string;
  folderName: string;
  notesCount: number;
  webViewLink: string | null;
  lastSourceUpdatedAt?: Date;
  createdAt: Date;
}): DailyDeliveryNotesReportUpload => ({
  ...upload,
  lastSourceUpdatedAt: upload.lastSourceUpdatedAt ?? upload.createdAt
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
    lastSourceUpdatedAt: Date;
    createdAt: Date;
  } | null>;
  findMany(args: {
    where: {
      reportDate?: {
        gte?: Date;
        lt?: Date;
      };
    };
    orderBy: {
      reportDate: "asc" | "desc";
    };
    take?: number;
    skip?: number;
  }): Promise<Array<{
    id: string;
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
    createdAt: Date;
  }>>;
  count(args: {
    where: {
      reportDate?: {
        gte?: Date;
        lt?: Date;
      };
    };
  }): Promise<number>;
  create(args: {
    data: {
      reportDate: Date;
      fileId: string;
      fileName: string;
      folderName: string;
      notesCount: number;
      webViewLink: string | null;
      lastSourceUpdatedAt: Date;
    };
  }): Promise<{
    id: string;
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
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
      lastSourceUpdatedAt: Date;
    };
  }): Promise<{
    id: string;
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
    createdAt: Date;
  }>;
  delete(args: {
    where: {
      reportDate: Date;
    };
  }): Promise<void>;
};

const dailyDeliveryNotesReportUploadDelegate = (
  prisma as unknown as {
    dailyDeliveryNotesReportUpload: DailyDeliveryNotesReportUploadDelegate;
  }
).dailyDeliveryNotesReportUpload;

export class PrismaDailyDeliveryNotesReportUploadRepository
  implements DailyDeliveryNotesReportUploadRepository
{
  public async findAll(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }) {
    const uploads = await dailyDeliveryNotesReportUploadDelegate.findMany({
      where: buildWhere(filters),
      orderBy: {
        reportDate: "desc"
      },
      take: filters.limit,
      skip: filters.offset
    });

    return uploads.map(toDomainUpload);
  }

  public async count(filters: {
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    return dailyDeliveryNotesReportUploadDelegate.count({
      where: buildWhere(filters)
    });
  }

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
    lastSourceUpdatedAt: Date;
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
    lastSourceUpdatedAt: Date;
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
        webViewLink: input.webViewLink,
        lastSourceUpdatedAt: input.lastSourceUpdatedAt
      }
    });

    return toDomainUpload(upload);
  }

  public async deleteByDate(reportDate: Date) {
    await dailyDeliveryNotesReportUploadDelegate.delete({
      where: {
        reportDate: normalizeReportDate(reportDate)
      }
    });
  }
}
