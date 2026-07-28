import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { DomainException } from "../../../domain/exceptions/DomainException.js";
import type {
  InvoicePreviewSnapshot,
  InvoiceRepository
} from "../../../domain/repositories/InvoiceRepository.js";
import { calculateInvoiceAmounts } from "../../../domain/services/invoiceMoney.js";

interface PreviewTokenPayload {
  deliveryNoteIds: string[];
  expiresAt: number;
  nonce: string;
  requester: string;
  snapshotHash: string;
}

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

export class PreviewInvoiceUseCase {
  public constructor(
    private readonly repository: InvoiceRepository,
    private readonly config: {
      enabled: boolean;
      series: string | null;
      taxRate: string;
      tokenSecret: string;
      ttlMs: number;
    }
  ) {}

  public async execute(deliveryNoteIds: string[], requester = "system") {
    if (!this.config.enabled) {
      throw new DomainException("La facturación Odoo está desactivada", 503);
    }
    const snapshot = await this.repository.preparePreview(
      deliveryNoteIds,
      this.config.taxRate,
      this.config.series
    );
    const expiresAt = Date.now() + this.config.ttlMs;
    const payload: PreviewTokenPayload = {
      deliveryNoteIds: [...deliveryNoteIds].sort(),
      expiresAt,
      nonce: randomUUID(),
      requester,
      snapshotHash: snapshot.snapshotHash
    };
    const encoded = encode(JSON.stringify(payload));
    const signature = createHmac("sha256", this.config.tokenSecret).update(encoded).digest("base64url");
    const { snapshotHash: _snapshotHash, ...preview } = snapshot;
    return {
      preview: {
        ...preview,
        issueDate: new Date(),
        deliveryNoteCount: preview.deliveryNotes.length,
        lineCount: preview.lines.length,
        warnings: [] as string[],
        lines: preview.lines.map((line) => ({
          ...line,
          total: calculateInvoiceAmounts([line.subtotal], line.taxRate).total
        })),
        issuer: {
          legalName: "EPOXIRON S.L.",
          vat: "B86428760",
          street: "C/ MARMOL 2 POL. INDS. LA TORRECILLA",
          city: "YELES",
          zip: "45220",
          province: "TOLEDO",
          countryCode: "ES"
        }
      },
      previewToken: `${encoded}.${signature}`,
      expiresAt: new Date(expiresAt)
    };
  }

  public verify(token: string, deliveryNoteIds: string[], requester = "system"): string {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) throw new DomainException("La previsualización no es válida", 409);
    const expected = createHmac("sha256", this.config.tokenSecret).update(encoded).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new DomainException("La previsualización no es válida", 409);
    }
    let payload: PreviewTokenPayload;
    try {
      payload = JSON.parse(decode(encoded)) as PreviewTokenPayload;
    } catch {
      throw new DomainException("La previsualización no es válida", 409);
    }
    const ids = [...deliveryNoteIds].sort();
    if (
      payload.expiresAt <= Date.now() ||
      payload.requester !== requester ||
      JSON.stringify(payload.deliveryNoteIds) !== JSON.stringify(ids)
    ) {
      throw new DomainException("La previsualización ha caducado o la selección ha cambiado", 409);
    }
    return payload.snapshotHash;
  }
}
