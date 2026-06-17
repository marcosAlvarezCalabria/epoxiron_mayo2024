import { describe, expect, it, vi } from "vitest";
import { DomainException } from "../../domain/exceptions/DomainException.js";
import {
  buildDailyFileName,
  buildMonthFolderName,
  buildR2PublicFileUrl,
  buildR2ReportKey,
  R2DriveUploader
} from "./R2DriveUploader.js";

describe("R2DriveUploader", () => {
  it("builds deterministic folder, file and key names", () => {
    const date = new Date("2026-06-17T10:30:00.000Z");

    expect(buildMonthFolderName(date)).toBe("2026-06");
    expect(buildDailyFileName(date)).toBe("albaranes-2026-06-17.pdf");
    expect(buildR2ReportKey(date)).toEqual({
      fileName: "albaranes-2026-06-17.pdf",
      folderName: "2026-06",
      key: "2026-06/albaranes-2026-06-17.pdf"
    });
    expect(
      buildR2PublicFileUrl(
        "https://archivos.wwwmarcos-alvarez.com/",
        "2026-06/albaranes-2026-06-17.pdf"
      )
    ).toBe("https://archivos.wwwmarcos-alvarez.com/2026-06/albaranes-2026-06-17.pdf");
  });

  it("uploads the pdf and returns a public url", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 200 });
    };
    const uploader = new R2DriveUploader(
      {
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucketName: "epoxiron-albaranes",
        publicBaseUrl: "https://archivos.wwwmarcos-alvarez.com/"
      },
      fetchMock
    );
    const attachment = {
      filename: "report.pdf",
      contentType: "application/pdf",
      content: Buffer.from("fake-pdf")
    };
    const date = new Date("2026-06-17T10:30:00.000Z");

    const result = await uploader.upload({ attachment, date });

    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    const url = firstCall?.url;
    const requestInit = firstCall?.init;
    expect(url).toBe(
      "https://account-id.r2.cloudflarestorage.com/epoxiron-albaranes/2026-06/albaranes-2026-06-17.pdf"
    );
    expect(requestInit?.method).toBe("PUT");
    expect(requestInit?.body).toEqual(new Uint8Array(attachment.content));
    const headers = requestInit?.headers as Record<string, string> | undefined;
    expect(headers).toMatchObject({
      "content-type": "application/pdf",
      host: "account-id.r2.cloudflarestorage.com"
    });
    expect(typeof headers?.authorization).toBe("string");
    expect(result).toEqual({
      fileId: "2026-06/albaranes-2026-06-17.pdf",
      fileName: "albaranes-2026-06-17.pdf",
      folderName: "2026-06",
      webViewLink: "https://archivos.wwwmarcos-alvarez.com/2026-06/albaranes-2026-06-17.pdf"
    });
  });

  it("checks whether an existing object is still present", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 200 });
    };
    const uploader = new R2DriveUploader(
      {
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucketName: "epoxiron-albaranes",
        publicBaseUrl: "https://archivos.wwwmarcos-alvarez.com/"
      },
      fetchMock
    );

    const exists = await uploader.exists({
      fileId: "2026-06/albaranes-2026-06-17.pdf"
    });

    expect(exists).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://account-id.r2.cloudflarestorage.com/epoxiron-albaranes/2026-06/albaranes-2026-06-17.pdf"
    );
    expect(calls[0]?.init?.method).toBe("HEAD");
  });

  it("deletes an existing object from R2", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    };
    const uploader = new R2DriveUploader(
      {
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucketName: "epoxiron-albaranes",
        publicBaseUrl: "https://archivos.wwwmarcos-alvarez.com/"
      },
      fetchMock
    );

    await uploader.delete({
      fileId: "2026-06/albaranes-2026-06-17.pdf"
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://account-id.r2.cloudflarestorage.com/epoxiron-albaranes/2026-06/albaranes-2026-06-17.pdf"
    );
    expect(calls[0]?.init?.method).toBe("DELETE");
  });

  it("wraps storage errors as a domain exception", async () => {
    const uploader = new R2DriveUploader(
      {
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucketName: "epoxiron-albaranes",
        publicBaseUrl: "https://archivos.wwwmarcos-alvarez.com"
      },
      vi.fn(async () => {
        throw new Error("signature mismatch");
      }) as typeof fetch
    );

    await expect(
      uploader.upload({
        attachment: {
          filename: "report.pdf",
          contentType: "application/pdf",
          content: Buffer.from("fake-pdf")
        },
        date: new Date("2026-06-17T10:30:00.000Z")
      })
    ).rejects.toEqual(new DomainException("R2 upload fallo: signature mismatch", 502));
  });

  it("surfaces upstream response bodies as a domain exception", async () => {
    const uploader = new R2DriveUploader(
      {
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucketName: "epoxiron-albaranes",
        publicBaseUrl: "https://archivos.wwwmarcos-alvarez.com"
      },
      vi.fn(async () => new Response("invalid signature", { status: 403 })) as typeof fetch
    );

    await expect(
      uploader.upload({
        attachment: {
          filename: "report.pdf",
          contentType: "application/pdf",
          content: Buffer.from("fake-pdf")
        },
        date: new Date("2026-06-17T10:30:00.000Z")
      })
    ).rejects.toEqual(new DomainException("R2 upload fallo: 403 invalid signature", 502));
  });
});
