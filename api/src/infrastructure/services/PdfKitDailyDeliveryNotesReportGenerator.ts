import PDFDocument from "pdfkit";
import type { DeliveryNote, DeliveryNoteTexture } from "../../domain/entities/DeliveryNote.js";
import type {
  DailyDeliveryNotesReportGenerator,
  DeliveryNoteReportCustomerDetails,
  ReportAttachment
} from "../../domain/services/DailyDeliveryNotesReportGenerator.js";

type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

const PAGE_MARGIN = 40;
const SECTION_PADDING = 18;
const SECTION_GAP = 18;
const CONTENT_WIDTH = 515;
const PAGE_HEIGHT = 842;
const COMPANY_NAME = "Epoxiron S.L.";
const TABLE_COLUMN_WIDTHS = {
  quantity: 64,
  price: 88,
  total: 96
} as const;
const TABLE_CELL_HORIZONTAL_PADDING = 8;
const TEXTURE_LABELS: Record<DeliveryNoteTexture, string> = {
  NORMAL: "Normal",
  MATE: "Mate",
  TEXTURADO: "Texturado",
  GOFRADO: "Gofrado"
};

const formatDocumentDate = (value: Date) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);

const formatDocumentNumber = (value: number) => value.toFixed(2).replace(".", ",");
const toPdfUppercase = (value: string) => value.trim().toLocaleUpperCase("es-ES");

const formatArticleTexture = (texture?: DeliveryNoteTexture) =>
  texture && texture !== "NORMAL" ? (TEXTURE_LABELS[texture] ?? texture) : null;

const formatMeters = (value: number | null | undefined) => formatDocumentNumber(value ?? 0);

const buildDocumentItemDescription = (item: DeliveryNote["items"][number]) => {
  const segments = [item.description, item.color];
  const texture = formatArticleTexture(item.texture);

  if (texture) {
    segments.push(texture);
  }

  if (item.pricingMode === "UNIT") {
    segments.push("UNIDAD");
  } else {
    if ((item.linearMeters ?? 0) > 0) {
      segments.push(`${formatMeters(item.linearMeters)}MLIN`);
    }

    if ((item.squareMeters ?? 0) > 0) {
      segments.push(`${formatMeters(item.squareMeters)}M2`);
    }
  }

  if (item.thickness != null) {
    segments.push("G");
  }

  if (item.primer) {
    segments.push("I");
  }

  return toPdfUppercase(segments.filter(Boolean).join(" · "));
};

const customerField = (value: string | null | undefined) =>
  value?.trim() ? toPdfUppercase(value) : "—";

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

const measureTextHeight = (
  document: PdfDocumentInstance,
  text: string,
  width: number,
  fontSize: number,
  align: "left" | "right" = "left"
) => document.fontSize(fontSize).heightOfString(text, { width, align, lineGap: 1 });

const drawText = (
  document: PdfDocumentInstance,
  input: {
    x: number;
    y: number;
    width: number;
    text: string;
    fontSize: number;
    color?: string;
    align?: "left" | "right";
  }
) => {
  document.x = input.x;
  document.y = input.y;
  document
    .fontSize(input.fontSize)
    .fillColor(input.color ?? "#111111")
    .text(input.text, {
      width: input.width,
      align: input.align ?? "left",
      lineGap: 1
    });
};

const drawRule = (document: PdfDocumentInstance, x: number, y: number, width: number) => {
  document.save().lineWidth(1).strokeColor("#D4D4D4").rect(x, y, width, 0.1).stroke().restore();
};

const buildNoteLayout = (
  document: PdfDocumentInstance,
  note: DeliveryNote,
  customer: DeliveryNoteReportCustomerDetails
) => {
  const contentWidth = CONTENT_WIDTH - SECTION_PADDING * 2;
  const leftWidth = 180;
  const rightWidth = contentWidth - leftWidth - 24;
  const metaColumnWidth = (contentWidth - 18) / 2;
  const descriptionWidth =
    contentWidth -
    TABLE_COLUMN_WIDTHS.quantity -
    TABLE_COLUMN_WIDTHS.price -
    TABLE_COLUMN_WIDTHS.total -
    24;
  const descriptionTextWidth = descriptionWidth - TABLE_CELL_HORIZONTAL_PADDING * 2;

  const companyLabelHeight = measureTextHeight(document, "EMPRESA", leftWidth, 10);
  const companyNameHeight = measureTextHeight(document, toPdfUppercase(COMPANY_NAME), leftWidth, 14);
  const companyBlockHeight = companyLabelHeight + 4 + companyNameHeight;

  const customerLines = [
    customer.name,
    customer.address ? customer.address : null,
    customer.phone ? customer.phone : null,
    !customer.phone && customer.email ? customer.email : null
  ].filter((value): value is string => Boolean(value));

  const customerLabelHeight = measureTextHeight(document, "CLIENTE", rightWidth, 10, "right");
  const customerTextHeight = customerLines.reduce((total, line, index) => {
    const fontSize = index === 0 ? 13 : 11;
    return total + measureTextHeight(document, toPdfUppercase(line), rightWidth, fontSize, "right") + (index === 0 ? 4 : 2);
  }, 0);
  const headerHeight = Math.max(companyBlockHeight, customerLabelHeight + 4 + customerTextHeight);

  const tableHeaderHeight = 22;
  const tableInfoHeight = 20;
  const tableFooterHeight = 22;
  const rowHeights = note.items.map((item) =>
    Math.max(
      24,
      measureTextHeight(document, buildDocumentItemDescription(item), descriptionTextWidth, 11) + 12
    )
  );
  const rowsHeight = rowHeights.reduce((sum, value) => sum + value, 0);

  const notesHeight = note.notes
    ? measureTextHeight(document, toPdfUppercase(note.notes), contentWidth - 24, 11) + 16
    : 0;

  const metadataHeight = 54;
  const tableHeight = tableHeaderHeight + tableInfoHeight + rowsHeight + tableFooterHeight;
  const totalHeight =
    SECTION_PADDING * 2 +
    headerHeight +
    16 +
    metadataHeight +
    16 +
    tableHeight +
    (note.notes ? SECTION_GAP + notesHeight : 0);

  return {
    contentWidth,
    customerLines,
    descriptionTextWidth,
    descriptionWidth,
    headerHeight,
    leftWidth,
    metaColumnWidth,
    notesHeight,
    rightWidth,
    rowHeights,
    tableFooterHeight,
    tableHeaderHeight,
    tableHeight,
    tableInfoHeight,
    totalHeight
  };
};

const renderNote = (
  document: PdfDocumentInstance,
  note: DeliveryNote,
  customer: DeliveryNoteReportCustomerDetails
) => {
  const {
    contentWidth,
    customerLines,
    descriptionTextWidth,
    descriptionWidth,
    headerHeight,
    leftWidth,
    metaColumnWidth,
    notesHeight,
    rightWidth,
    rowHeights,
    tableFooterHeight,
    tableHeaderHeight,
    tableHeight,
    tableInfoHeight,
    totalHeight
  } = buildNoteLayout(document, note, customer);

  const sectionX = PAGE_MARGIN;
  const sectionY = PAGE_MARGIN;
  const sectionWidth = CONTENT_WIDTH;
  const sectionBottom = Math.min(sectionY + totalHeight, PAGE_HEIGHT - PAGE_MARGIN);

  document
    .save()
    .lineWidth(1)
    .strokeColor("#D4D4D4")
    .rect(sectionX, sectionY, sectionWidth, sectionBottom - sectionY)
    .stroke()
    .restore();

  const contentX = sectionX + SECTION_PADDING;
  let cursorY = sectionY + SECTION_PADDING;

  drawText(document, {
    x: contentX,
    y: cursorY,
    width: leftWidth,
    text: "EMPRESA",
    fontSize: 10,
    color: "#737373"
  });
  drawText(document, {
    x: contentX,
    y: cursorY + 14,
    width: leftWidth,
    text: toPdfUppercase(COMPANY_NAME),
    fontSize: 14
  });

  drawText(document, {
    x: contentX + leftWidth + 24,
    y: cursorY,
    width: rightWidth,
    text: "CLIENTE",
    fontSize: 10,
    color: "#737373",
    align: "right"
  });

  let customerY = cursorY + 14;
  customerLines.forEach((line, index) => {
    const fontSize = index === 0 ? 13 : 11;
    const text = toPdfUppercase(line);

    drawText(document, {
      x: contentX + leftWidth + 24,
      y: customerY,
      width: rightWidth,
      text,
      fontSize,
      color: index === 0 ? "#111111" : "#404040",
      align: "right"
    });
    customerY += measureTextHeight(document, text, rightWidth, fontSize, "right") + (index === 0 ? 4 : 2);
  });

  cursorY += headerHeight + 12;
  drawRule(document, contentX, cursorY, contentWidth);
  cursorY += 14;

  const topMetaY = cursorY;
  const bottomMetaY = cursorY + 28;

  [
    { label: "ALBARAN", value: toPdfUppercase(note.number), x: contentX, y: topMetaY, width: metaColumnWidth },
    {
      label: "FECHA",
      value: formatDocumentDate(note.date),
      x: contentX + metaColumnWidth + 18,
      y: topMetaY,
      width: metaColumnWidth
    },
    {
      label: "CLIENTE",
      value: toPdfUppercase(customer.name),
      x: contentX,
      y: bottomMetaY,
      width: metaColumnWidth
    },
    {
      label: "TELEFONO",
      value: customerField(customer.phone),
      x: contentX + metaColumnWidth + 18,
      y: bottomMetaY,
      width: metaColumnWidth
    }
  ].forEach((cell) => {
    drawText(document, {
      x: cell.x,
      y: cell.y,
      width: cell.width,
      text: cell.label,
      fontSize: 9,
      color: "#737373"
    });
    drawText(document, {
      x: cell.x,
      y: cell.y + 11,
      width: cell.width,
      text: cell.value,
      fontSize: 11
    });
  });

  cursorY += 54;
  drawRule(document, contentX, cursorY, contentWidth);
  cursorY += 16;

  const tableX = contentX;
  const quantityX = tableX + descriptionWidth;
  const priceX = quantityX + TABLE_COLUMN_WIDTHS.quantity;
  const totalX = priceX + TABLE_COLUMN_WIDTHS.price;

  document.save().lineWidth(1).strokeColor("#D4D4D4").rect(tableX, cursorY, contentWidth, tableHeight).stroke().restore();

  drawText(document, {
    x: tableX + TABLE_CELL_HORIZONTAL_PADDING,
    y: cursorY + 6,
    width: descriptionTextWidth,
    text: "DESCRIPCION",
    fontSize: 10,
    color: "#737373"
  });
  drawText(document, {
    x: quantityX,
    y: cursorY + 6,
    width: TABLE_COLUMN_WIDTHS.quantity - TABLE_CELL_HORIZONTAL_PADDING,
    text: "UNID.",
    fontSize: 10,
    color: "#737373",
    align: "right"
  });
  drawText(document, {
    x: priceX,
    y: cursorY + 6,
    width: TABLE_COLUMN_WIDTHS.price - TABLE_CELL_HORIZONTAL_PADDING,
    text: "PRECIO",
    fontSize: 10,
    color: "#737373",
    align: "right"
  });
  drawText(document, {
    x: totalX,
    y: cursorY + 6,
    width: TABLE_COLUMN_WIDTHS.total - TABLE_CELL_HORIZONTAL_PADDING,
    text: "IMPORTE",
    fontSize: 10,
    color: "#737373",
    align: "right"
  });

  const tableInfoY = cursorY + tableHeaderHeight;
  drawRule(document, tableX, tableInfoY, contentWidth);
  drawText(document, {
    x: tableX + TABLE_CELL_HORIZONTAL_PADDING,
    y: tableInfoY + 5,
    width: contentWidth - TABLE_CELL_HORIZONTAL_PADDING * 2,
    text: `ALBARAN ${toPdfUppercase(note.number)} FECHA ${formatDocumentDate(note.date)}`,
    fontSize: 11,
    color: "#404040"
  });

  let rowY = tableInfoY + tableInfoHeight;
  note.items.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    const rowDescription = buildDocumentItemDescription(item);
    const rowTop = rowY + 6;

    if (index > 0) {
      drawRule(document, tableX, rowY, contentWidth);
    }

    drawText(document, {
      x: tableX + TABLE_CELL_HORIZONTAL_PADDING,
      y: rowTop,
      width: descriptionTextWidth,
      text: rowDescription,
      fontSize: 11
    });
    drawText(document, {
      x: quantityX,
      y: rowTop,
      width: TABLE_COLUMN_WIDTHS.quantity - TABLE_CELL_HORIZONTAL_PADDING,
      text: item.quantity.toString(),
      fontSize: 11,
      align: "right"
    });
    drawText(document, {
      x: priceX,
      y: rowTop,
      width: TABLE_COLUMN_WIDTHS.price - TABLE_CELL_HORIZONTAL_PADDING,
      text: formatDocumentNumber(item.customUnitPrice ?? item.unitPrice),
      fontSize: 11,
      align: "right"
    });
    drawText(document, {
      x: totalX,
      y: rowTop,
      width: TABLE_COLUMN_WIDTHS.total - TABLE_CELL_HORIZONTAL_PADDING,
      text: formatDocumentNumber(item.totalPrice),
      fontSize: 11,
      align: "right"
    });

    rowY += rowHeight;
  });

  drawRule(document, tableX, rowY, contentWidth);
  drawText(document, {
    x: tableX + TABLE_CELL_HORIZONTAL_PADDING,
    y: rowY + 6,
    width: contentWidth / 2,
    text: "SUMA Y SIGUE",
    fontSize: 11,
    color: "#404040"
  });
  drawText(document, {
    x: totalX,
    y: rowY + 6,
    width: TABLE_COLUMN_WIDTHS.total - TABLE_CELL_HORIZONTAL_PADDING,
    text: formatDocumentNumber(note.totalAmount),
    fontSize: 11,
    color: "#404040",
    align: "right"
  });

  cursorY = rowY + tableFooterHeight;

  if (note.notes && notesHeight > 0) {
    cursorY += SECTION_GAP;
    document.save().lineWidth(1).strokeColor("#D4D4D4").rect(contentX, cursorY, contentWidth, notesHeight).stroke().restore();
    drawText(document, {
      x: contentX + TABLE_CELL_HORIZONTAL_PADDING,
      y: cursorY + 8,
      width: contentWidth - TABLE_CELL_HORIZONTAL_PADDING * 2,
      text: toPdfUppercase(note.notes),
      fontSize: 11,
      color: "#404040"
    });
  }
};

export class PdfKitDailyDeliveryNotesReportGenerator implements DailyDeliveryNotesReportGenerator {
  public async generate(input: {
    date: Date;
    notes: DeliveryNote[];
    customersById: Record<string, DeliveryNoteReportCustomerDetails>;
  }): Promise<ReportAttachment> {
    const document = new PDFDocument({
      autoFirstPage: true,
      margin: PAGE_MARGIN,
      size: "A4"
    });

    input.notes.forEach((note, index) => {
      if (index > 0) {
        document.addPage();
      }

      renderNote(document, note, input.customersById[note.customerId] ?? {
        name: note.customerName,
        email: null,
        phone: null,
        address: null
      });
    });

    const content = await collectBuffer(document);

    return {
      content,
      contentType: "application/pdf",
      filename: `albaranes-${input.date.toISOString().slice(0, 10)}.pdf`
    };
  }
}
