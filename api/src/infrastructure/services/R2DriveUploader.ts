import { createHash, createHmac } from "node:crypto";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import type { ReportAttachment } from "../../domain/services/DailyDeliveryNotesReportGenerator.js";
import type {
  DailyDeliveryNotesReportUploader,
  DailyDeliveryNotesReportUploadResult
} from "../../domain/services/DailyDeliveryNotesReportUploader.js";

interface R2DriveUploaderConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
}

interface SignedR2Request {
  headers: Record<string, string>;
  url: string;
}

interface SignedUploadRequest extends SignedR2Request {
  body: Buffer;
}

type FetchLike = typeof fetch;

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const HASHED_EMPTY_STRING = createHash("sha256").update("").digest("hex");

export const buildMonthFolderName = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const buildDailyFileName = (date: Date) =>
  `albaranes-${date.toISOString().slice(0, 10)}.pdf`;

export const buildR2ReportKey = (date: Date) => {
  const folderName = buildMonthFolderName(date);
  const fileName = buildDailyFileName(date);

  return {
    fileName,
    folderName,
    key: `${folderName}/${fileName}`
  };
};

export const buildR2PublicFileUrl = (publicBaseUrl: string, key: string) =>
  `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;

const hashHex = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

const encodeR2Path = (bucketName: string, key: string) =>
  `/${[bucketName, ...key.split("/")].map((segment) => encodeURIComponent(segment)).join("/")}`;

const buildAmzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const buildDateStamp = (date: Date) => buildAmzDate(date).slice(0, 8);

const buildCredentialScope = (dateStamp: string) =>
  `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

const buildSigningKey = (secretAccessKey: string, dateStamp: string) => {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, R2_REGION);
  const serviceKey = hmac(regionKey, R2_SERVICE);

  return hmac(serviceKey, "aws4_request");
};

const buildAuthorizationHeader = (input: {
  accessKeyId: string;
  canonicalRequest: string;
  amzDate: string;
  dateStamp: string;
  secretAccessKey: string;
  signedHeaders: string;
}) => {
  const canonicalRequestHash = hashHex(input.canonicalRequest);
  const credentialScope = buildCredentialScope(input.dateStamp);
  const stringToSign = ["AWS4-HMAC-SHA256", input.amzDate, credentialScope, canonicalRequestHash].join("\n");
  const signature = createHmac("sha256", buildSigningKey(input.secretAccessKey, input.dateStamp))
    .update(stringToSign)
    .digest("hex");

  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${input.signedHeaders}, Signature=${signature}`;
};

const buildSignedR2Request = (input: {
  accountId: string;
  accessKeyId: string;
  bucketName: string;
  date: Date;
  key: string;
  method: "DELETE" | "HEAD" | "PUT";
  payloadHash: string;
  secretAccessKey: string;
  contentType?: string;
}): SignedR2Request => {
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const pathname = encodeR2Path(input.bucketName, input.key);
  const url = `https://${host}${pathname}`;
  const amzDate = buildAmzDate(input.date);
  const dateStamp = buildDateStamp(input.date);
  const headerEntries: Array<[string, string]> = [];
  if (input.contentType) {
    headerEntries.push(["content-type", input.contentType]);
  }
  headerEntries.push(["host", host]);
  headerEntries.push(["x-amz-content-sha256", input.payloadHash]);
  headerEntries.push(["x-amz-date", amzDate]);
  const canonicalHeaders = headerEntries
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const signedHeaders = headerEntries.map(([key]) => key).join(";");
  const canonicalRequest = [
    input.method,
    pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash
  ].join("\n");

  return {
    headers: {
      ...(input.contentType ? { "content-type": input.contentType } : {}),
      authorization: buildAuthorizationHeader({
        accessKeyId: input.accessKeyId,
        canonicalRequest,
        amzDate,
        dateStamp,
        secretAccessKey: input.secretAccessKey,
        signedHeaders
      }),
      host,
      "x-amz-content-sha256": input.payloadHash || HASHED_EMPTY_STRING,
      "x-amz-date": amzDate
    },
    url
  };
};

const buildSignedDeleteRequest = (input: {
  accountId: string;
  accessKeyId: string;
  bucketName: string;
  date: Date;
  key: string;
  secretAccessKey: string;
}): SignedR2Request =>
  buildSignedR2Request({
    accountId: input.accountId,
    accessKeyId: input.accessKeyId,
    bucketName: input.bucketName,
    date: input.date,
    key: input.key,
    method: "DELETE",
    payloadHash: HASHED_EMPTY_STRING,
    secretAccessKey: input.secretAccessKey
  });

const buildSignedUploadRequest = (input: {
  accountId: string;
  accessKeyId: string;
  attachment: ReportAttachment;
  bucketName: string;
  date: Date;
  key: string;
  secretAccessKey: string;
}): SignedUploadRequest => {
  const request = buildSignedR2Request({
    accountId: input.accountId,
    accessKeyId: input.accessKeyId,
    bucketName: input.bucketName,
    date: input.date,
    key: input.key,
    method: "PUT",
    payloadHash: hashHex(input.attachment.content),
    secretAccessKey: input.secretAccessKey,
    contentType: input.attachment.contentType
  });

  return {
    body: input.attachment.content,
    headers: request.headers,
    url: request.url
  };
};

const buildSignedHeadRequest = (input: {
  accountId: string;
  accessKeyId: string;
  bucketName: string;
  date: Date;
  key: string;
  secretAccessKey: string;
}): SignedR2Request =>
  buildSignedR2Request({
    accountId: input.accountId,
    accessKeyId: input.accessKeyId,
    bucketName: input.bucketName,
    date: input.date,
    key: input.key,
    method: "HEAD",
    payloadHash: HASHED_EMPTY_STRING,
    secretAccessKey: input.secretAccessKey
  });

export class R2DriveUploader implements DailyDeliveryNotesReportUploader {
  public constructor(
    private readonly config: R2DriveUploaderConfig,
    private readonly fetchImplementation: FetchLike = fetch
  ) {}

  public async exists(input: { fileId: string }): Promise<boolean> {
    const request = buildSignedHeadRequest({
      accountId: this.config.accountId,
      accessKeyId: this.config.accessKeyId,
      bucketName: this.config.bucketName,
      date: new Date(),
      key: input.fileId,
      secretAccessKey: this.config.secretAccessKey
    });

    let response: Response;

    try {
      response = await this.fetchImplementation(request.url, {
        method: "HEAD",
        headers: request.headers
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DomainException(`R2 comprobacion fallo: ${message}`, 502);
    }

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const details = body.trim() ? ` ${body.trim()}` : "";
      throw new DomainException(`R2 comprobacion fallo: ${response.status}${details}`, 502);
    }

    return true;
  }

  public async delete(input: { fileId: string }): Promise<void> {
    const request = buildSignedDeleteRequest({
      accountId: this.config.accountId,
      accessKeyId: this.config.accessKeyId,
      bucketName: this.config.bucketName,
      date: new Date(),
      key: input.fileId,
      secretAccessKey: this.config.secretAccessKey
    });

    let response: Response;

    try {
      response = await this.fetchImplementation(request.url, {
        method: "DELETE",
        headers: request.headers
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DomainException(`R2 borrado fallo: ${message}`, 502);
    }

    if (response.status === 404 || response.ok) {
      return;
    }

    const body = await response.text().catch(() => "");
    const details = body.trim() ? ` ${body.trim()}` : "";
    throw new DomainException(`R2 borrado fallo: ${response.status}${details}`, 502);
  }

  public async upload(input: {
    attachment: ReportAttachment;
    date: Date;
  }): Promise<DailyDeliveryNotesReportUploadResult> {
    const { fileName, folderName, key } = buildR2ReportKey(input.date);
    const request = buildSignedUploadRequest({
      accountId: this.config.accountId,
      accessKeyId: this.config.accessKeyId,
      attachment: input.attachment,
      bucketName: this.config.bucketName,
      date: new Date(),
      key,
      secretAccessKey: this.config.secretAccessKey
    });

    let response: Response;

    try {
      response = await this.fetchImplementation(request.url, {
        method: "PUT",
        headers: request.headers,
        body: new Uint8Array(request.body)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DomainException(`R2 upload fallo: ${message}`, 502);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const details = body.trim() ? ` ${body.trim()}` : "";
      throw new DomainException(`R2 upload fallo: ${response.status}${details}`, 502);
    }

    return {
      fileId: key,
      fileName,
      folderName,
      webViewLink: buildR2PublicFileUrl(this.config.publicBaseUrl, key)
    };
  }
}
