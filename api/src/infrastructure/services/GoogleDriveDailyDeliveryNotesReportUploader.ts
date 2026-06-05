import { createSign, randomUUID } from "node:crypto";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type {
  DailyDeliveryNotesReportUploader,
  DailyDeliveryNotesReportUploadResult
} from "../../domain/services/DailyDeliveryNotesReportUploader.js";
import type { ReportAttachment } from "../../domain/services/DailyDeliveryNotesReportGenerator.js";

interface GoogleDriveDailyDeliveryNotesReportUploaderConfig {
  rootFolderId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink?: string | null;
}

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const toBase64Url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const buildMonthFolderName = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const buildDailyFileName = (date: Date) => `albaranes-${date.toISOString().slice(0, 10)}.pdf`;
const normalizePrivateKey = (value: string) => value.replace(/\\n/g, "\n");

const ensureOk = async (response: Response, operation: string) => {
  if (response.ok) {
    return response;
  }

  const body = await response.text();
  throw new DomainException(`Google Drive fallo en ${operation}: ${body || response.statusText}`, 502);
};

export class GoogleDriveDailyDeliveryNotesReportUploader implements DailyDeliveryNotesReportUploader {
  public constructor(private readonly config: GoogleDriveDailyDeliveryNotesReportUploaderConfig) {}

  public async upload(input: {
    attachment: ReportAttachment;
    date: Date;
  }): Promise<DailyDeliveryNotesReportUploadResult> {
    const accessToken = await this.getAccessToken();
    const folderName = buildMonthFolderName(input.date);
    const fileName = buildDailyFileName(input.date);
    const monthFolderId = await this.ensureMonthFolder(accessToken, folderName);
    const existingFile = await this.findFile(accessToken, monthFolderId, fileName, input.attachment.contentType);
    const uploadedFile = existingFile
      ? await this.updateFile(accessToken, existingFile.id, input.attachment)
      : await this.createFile(accessToken, monthFolderId, fileName, input.attachment);

    return {
      fileId: uploadedFile.id,
      fileName: uploadedFile.name,
      folderName,
      webViewLink: uploadedFile.webViewLink ?? null
    };
  }

  private async getAccessToken() {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.serviceAccountEmail,
      scope: GOOGLE_DRIVE_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      exp: issuedAt + 3600,
      iat: issuedAt
    };

    const unsignedToken = [
      toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      toBase64Url(JSON.stringify(payload))
    ].join(".");

    const signer = createSign("RSA-SHA256");
    signer.update(unsignedToken);
    signer.end();

    const signature = signer.sign(normalizePrivateKey(this.config.serviceAccountPrivateKey));
    const assertion = `${unsignedToken}.${toBase64Url(signature)}`;

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      }).toString()
    });

    const validResponse = await ensureOk(response, "obtener token OAuth");
    const data = (await validResponse.json()) as { access_token?: string };

    if (!data.access_token) {
      throw new DomainException("Google Drive no devolvio access_token", 502);
    }

    return data.access_token;
  }

  private async ensureMonthFolder(accessToken: string, folderName: string) {
    const existing = await this.findFile(
      accessToken,
      this.config.rootFolderId,
      folderName,
      GOOGLE_DRIVE_FOLDER_MIME_TYPE
    );

    if (existing) {
      return existing.id;
    }

    const response = await fetch(`${GOOGLE_DRIVE_FILES_URL}?fields=id,name,webViewLink`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        name: folderName,
        parents: [this.config.rootFolderId]
      })
    });

    const validResponse = await ensureOk(response, "crear carpeta mensual");
    const data = (await validResponse.json()) as GoogleDriveFile;
    return data.id;
  }

  private async findFile(
    accessToken: string,
    parentId: string,
    name: string,
    mimeType: string
  ): Promise<GoogleDriveFile | null> {
    const query = [
      `'${parentId}' in parents`,
      `name = '${name.replace(/'/g, "\\'")}'`,
      `mimeType = '${mimeType}'`,
      "trashed = false"
    ].join(" and ");

    const url = new URL(GOOGLE_DRIVE_FILES_URL);
    url.searchParams.set("fields", "files(id,name,webViewLink)");
    url.searchParams.set("pageSize", "1");
    url.searchParams.set("q", query);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const validResponse = await ensureOk(response, "buscar archivo en Drive");
    const data = (await validResponse.json()) as { files?: GoogleDriveFile[] };
    return data.files?.[0] ?? null;
  }

  private async createFile(
    accessToken: string,
    parentId: string,
    fileName: string,
    attachment: ReportAttachment
  ) {
    return this.uploadMultipart(
      accessToken,
      "POST",
      `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`,
      {
        name: fileName,
        parents: [parentId]
      },
      attachment,
      "subir archivo diario"
    );
  }

  private async updateFile(
    accessToken: string,
    fileId: string,
    attachment: ReportAttachment
  ) {
    return this.uploadMultipart(
      accessToken,
      "PATCH",
      `${GOOGLE_DRIVE_UPLOAD_URL}/${fileId}?uploadType=multipart&fields=id,name,webViewLink`,
      {},
      attachment,
      "reemplazar archivo diario"
    );
  }

  private async uploadMultipart(
    accessToken: string,
    method: "POST" | "PATCH",
    url: string,
    metadata: Record<string, unknown>,
    attachment: ReportAttachment,
    operation: string
  ) {
    const boundary = `epoxiron-${randomUUID()}`;
    const metadataPart =
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n`;
    const filePartHeader =
      `--${boundary}\r\n` +
      `Content-Type: ${attachment.contentType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;

    const body = Buffer.concat([
      Buffer.from(metadataPart),
      Buffer.from(filePartHeader),
      attachment.content,
      Buffer.from(footer)
    ]);

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    });

    const validResponse = await ensureOk(response, operation);
    return (await validResponse.json()) as GoogleDriveFile;
  }
}
