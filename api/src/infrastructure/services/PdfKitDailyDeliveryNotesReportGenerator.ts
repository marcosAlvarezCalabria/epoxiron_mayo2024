import PDFDocument from "pdfkit";
import type {
  DailyDeliveryNotesReportGenerator,
  ReportAttachment
} from "../../domain/services/DailyDeliveryNotesReportGenerator.js";
import type { DeliveryNote, DeliveryNoteTexture } from "../../domain/entities/DeliveryNote.js";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);

const formatCurrency = (value: number) => `${value.toFixed(2)} EUR`;
const formatMillimeters = (value: number | null | undefined) => `${(value ?? 0) * 1000}`;
const formatSquareMillimeters = (value: number | null | undefined) => `${(value ?? 0) * 1000000}`;
const textureLabel: Record<DeliveryNoteTexture, string> = {
  NORMAL: "Normal",
  MATE: "Mate",
  TEXTURADO: "Texturado",
  GOFRADO: "Gofrado"
};

const buildItemSummary = (item: DeliveryNote["items"][number]) => {
  const segments = [
    item.description,
    item.color,
    textureLabel[item.texture] ?? item.texture,
    `x${item.quantity}`,
    `MM ${formatMillimeters(item.linearMeters)}`,
    `MM2 ${formatSquareMillimeters(item.squareMeters)}`
  ];

  if (item.thickness) {
    segments.push("G");
  }

  if (item.primer) {
    segments.push("I");
  }

  segments.push(formatCurrency(item.totalPrice));

  return segments.join(" | ");
};

type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

const ensureSpace = (document: PdfDocumentInstance, heightNeeded: number) => {
  if (document.y + heightNeeded <= document.page.height - document.page.margins.bottom) {
    return;
  }

  document.addPage();
};

const collectBuffer = async (document: PdfDocumentInstance): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", reject);
    document.end();
  });

export class PdfKitDailyDeliveryNotesReportGenerator
  implements DailyDeliveryNotesReportGenerator
{
  public async generate(input: { date: Date; notes: DeliveryNote[] }): Promise<ReportAttachment> {
    const document = new PDFDocument({
      autoFirstPage: true,
      margin: 40,
      size: "A4"
    });

    const totalAmount = input.notes.reduce((sum, note) => sum + note.totalAmount, 0);
    const totalPieces = input.notes.reduce(
      (sum, note) => sum + note.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const reportDate = formatDate(input.date);

    document.fontSize(20).fillColor("#111111").text("Albaranes del dia");
    document.moveDown(0.35);
    document.fontSize(10).fillColor("#666666").text(`Fecha: ${reportDate}`);
    document.moveDown(0.8);

    document
      .fontSize(10)
      .fillColor("#111111")
      .text(`Albaranes: ${input.notes.length}`, { continued: true })
      .text(`   Piezas: ${totalPieces}`, { continued: true })
      .text(`   Total: ${formatCurrency(totalAmount)}`);

    document.moveDown(1);

    input.notes.forEach((note) => {
      const blockHeight = 54 + note.items.length * 16;
      ensureSpace(document, blockHeight);

      const boxTop = document.y;
      const boxHeight = Math.max(blockHeight, 72);

      document
        .save()
        .lineWidth(1)
        .strokeColor("#D4D4D4")
        .rect(document.page.margins.left, boxTop, document.page.width - 80, boxHeight)
        .stroke()
        .restore();

      document.x = document.page.margins.left + 12;
      document.y = boxTop + 10;

      document.fontSize(12).fillColor("#111111").text(note.number, { continued: true });
      document.fontSize(10).fillColor("#666666").text(`   ${note.customerName}`, { continued: true });
      document
        .fontSize(10)
        .fillColor("#666666")
        .text(`   ${formatDate(note.date)}`, { continued: true })
        .text(`   ${formatCurrency(note.totalAmount)}`);

      document.moveDown(0.45);
      document.fontSize(9).fillColor("#111111");

      note.items.forEach((item) => {
        document.text(buildItemSummary(item), {
          width: document.page.width - 104
        });
      });

      if (note.notes) {
        document.moveDown(0.35);
        document.fontSize(8).fillColor("#666666").text(`Notas: ${note.notes}`, {
          width: document.page.width - 104
        });
      }

      document.y = boxTop + boxHeight + 12;
    });

    const content = await collectBuffer(document);

    return {
      content,
      contentType: "application/pdf",
      filename: `albaranes-${input.date.toISOString().slice(0, 10)}.pdf`
    };
  }
}
