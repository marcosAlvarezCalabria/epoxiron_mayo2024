import type { CalculatePriceUseCase, CreateDeliveryNoteUseCase } from "./deliveryNotes.js";
import type { ParseVoiceAlbaranUseCase } from "./parseVoiceAlbaran.js";
import type { Customer } from "../../domain/entities/Customer.js";
import type { DeliveryNoteItemDraft } from "../../domain/entities/DeliveryNote.js";
import type { CustomerRepository } from "../../domain/repositories/CustomerRepository.js";
import type {
  TelegramDeliveryNoteDraft,
  TelegramDeliveryNoteProposal,
  TelegramDeliveryNoteSession,
  TelegramDeliveryNoteSessionRepository
} from "../../domain/repositories/TelegramDeliveryNoteSessionRepository.js";
import { normalizeSpecialPieceName } from "../../domain/services/deliveryNoteItemDescription.js";

export interface TelegramAssistantInput {
  chatId: string;
  userId: string;
  updateId: number;
  text: string;
}

type CustomerLookup = Pick<CustomerRepository, "findAll" | "findById">;
type VoiceParser = Pick<ParseVoiceAlbaranUseCase, "execute">;
type PriceCalculator = Pick<CalculatePriceUseCase, "execute">;
type DeliveryNoteCreator = Pick<CreateDeliveryNoteUseCase, "execute">;

export interface TelegramDeliveryNoteAssistantOptions {
  proposalTtlMs: number;
  writesEnabled: boolean;
}

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isReset = (value: string): boolean =>
  ["new", "barra new", "nuevo", "empezar de nuevo"].includes(normalizeText(value));

const isFinish = (value: string): boolean =>
  ["ya esta", "he terminado", "terminado", "fin"].includes(normalizeText(value));

const isConfirmation = (value: string): boolean => normalizeText(value) === "si";

const isRejection = (value: string): boolean => {
  const normalized = normalizeText(value);
  return normalized === "no" ||
    /^(?:no\s+)?(?:cancelar|cancela|cancelalo|descartar|descarta|descartalo)$/.test(normalized);
};

const isHelp = (value: string): boolean =>
  ["start", "help", "ayuda"].includes(normalizeText(value));

const HELP_TEXT = [
  "👋 Agente de Albaranes de Epoxiron",
  "",
  "Comandos y pasos:",
  "• /new — empieza un albarán nuevo o descarta el borrador actual.",
  "• Dicta el cliente y las piezas. Puedes enviarlas en varios mensajes.",
  "• Puedes corregir cantidad, color, acabado, cliente o eliminar líneas.",
  "• YA ESTÁ — prepara la propuesta para revisarla.",
  "• SI — confirma la propuesta y crea el albarán en borrador (DRAFT).",
  "• NO — cancela la propuesta y el borrador.",
  "• /help — vuelve a mostrar esta guía.",
  "",
  "Ejemplo: cliente Ditrametal, dos chapas de 100 x 50 cm RAL 9005.",
  "Nada se crea hasta que respondas SI a una propuesta."
].join("\n");

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value);

const findCustomer = (
  customers: Customer[],
  customerName: string | null
): Customer | null => {
  if (!customerName) return null;
  const normalized = normalizeText(customerName);
  return customers.find((customer) => normalizeText(customer.name) === normalized) ?? null;
};

const toDraftItem = (
  customer: Customer,
  item: TelegramDeliveryNoteDraft["items"][number]
): { item: DeliveryNoteItemDraft | null; error: string | null } => {
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    return { item: null, error: `${item.description}: la cantidad debe ser mayor que cero.` };
  }

  const color = normalizeAgentColor(item.color);
  if (!color) {
    return { item: null, error: `${item.description}: falta el color.` };
  }

  const specialPiece =
    customer.specialPieces.find(
      (piece) =>
        normalizeSpecialPieceName(piece.name) ===
        normalizeSpecialPieceName(item.description)
    ) ?? null;

  if (item.specialPieceIntent && !specialPiece) {
    return {
      item: null,
      error: `${item.description}: no coincide con una pieza especial de ${customer.name}.`
    };
  }

  return {
    error: null,
    item: {
      description: specialPiece?.name ?? item.description,
      color,
      texture: item.texture,
      pricingMode: "DIMENSIONS",
      customUnitPrice: null,
      linearMeters: item.linearMeters,
      squareMeters: item.squareMeters,
      thickness: item.hasThickness ? 1 : null,
      primer: item.hasPrimer,
      quantity: item.quantity,
      saveAsSpecialPiece: false
    }
  };
};

const proposalText = (proposal: TelegramDeliveryNoteProposal): string => {
  const lines = proposal.lines.map((line, index) => {
    const measures = [
      line.item.linearMeters != null ? `${line.item.linearMeters} ml` : null,
      line.item.squareMeters != null ? `${line.item.squareMeters} m²` : null,
      line.item.thickness ? "con grosor" : null,
      line.item.primer ? "con imprimación" : null
    ].filter((value): value is string => value !== null);

    return [
      `${index + 1}. ${line.item.description}`,
      line.item.color,
      line.item.texture ?? "NORMAL",
      `${line.item.quantity} ud.`,
      measures.join(", "),
      `${formatMoney(line.unitPrice)}/ud.`,
      `total ${formatMoney(line.totalPrice)}`
    ]
      .filter(Boolean)
      .join(" · ");
  });

  return [
    "PROPUESTA DE ALBARÁN",
    `Cliente: ${proposal.customerName}`,
    `Fecha: ${proposal.date}`,
    ...lines,
    `TOTAL: ${formatMoney(proposal.totalAmount)}`,
    "",
    "Confirma con SI por voz o por escrito. Cualquier otro mensaje no crea el albarán."
  ].join("\n");
};

const sameMoney = (left: number, right: number): boolean =>
  Math.round(left * 100) === Math.round(right * 100);

const SPANISH_INTEGERS: Readonly<Record<string, number>> = {
  cero: 0,
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10
};

const parsePositiveInteger = (value: string | undefined): number | null => {
  if (!value) return null;
  const normalized = normalizeText(value);
  const parsed = /^\d+$/.test(normalized)
    ? Number.parseInt(normalized, 10)
    : SPANISH_INTEGERS[normalized];
  return parsed != null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeAgentColor = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = normalizeText(value);
  if (/^ral\s*9005$/.test(normalized) || /^(?:negro|negra)$/.test(normalized)) {
    return "RAL 9005";
  }
  if (/^ral\s*9010$/.test(normalized) || /^(?:blanco|blanca)$/.test(normalized)) {
    return "RAL 9010";
  }
  const ral = normalized.match(/\bral\s*(\d{4})\b/);
  return ral ? `RAL ${ral[1]}` : null;
};

const extractRequestedColor = (value: string): string | null => {
  const normalized = normalizeText(value);
  const ralMatches = [...normalized.matchAll(/\bral\s*(\d{4})\b/g)];
  const lastRal = ralMatches.at(-1);
  if (lastRal?.[1]) return `RAL ${lastRal[1]}`;
  const numericRal = normalized.match(/\b([1-9]\d{3})\b/);
  if (numericRal?.[1]) return `RAL ${numericRal[1]}`;
  if (/\b(?:blanco|blanca)\b/.test(normalized)) return "RAL 9010";
  if (/\b(?:negro|negra)\b/.test(normalized)) return "RAL 9005";
  return null;
};

const extractRequestedTexture = (
  value: string
): TelegramDeliveryNoteDraft["items"][number]["texture"] | null => {
  const normalized = normalizeText(value);
  if (/\b(?:texturado|texturizado)\b/.test(normalized)) return "TEXTURADO";
  if (/\b(?:gofrado|gof)\b/.test(normalized)) return "GOFRADO";
  if (/\bmate\b/.test(normalized)) return "MATE";
  if (/\bnormal\b/.test(normalized)) return "NORMAL";
  return null;
};

const isShortTextureCorrection = (value: string): boolean => {
  const normalized = normalizeText(value);
  const residue = normalized
    .replace(/\b(?:ral\s*)?[1-9]\d{3}\b/g, " ")
    .replace(/\b(?:texturado|texturizado|gofrado|gof|mate|normal)\b/g, " ")
    .replace(/\b(?:y|el|la|color|acabado|es|pon|cambia|cambiar|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return residue.length === 0;
};

const withoutCommonColor = (description: string): string =>
  description
    .replace(/\b(?:NEGRO|NEGRA|BLANCO|BLANCA|ROJO|ROJA|ROJOS|ROJAS)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsNegativeQuantity = (value: string): boolean =>
  /(?:^|\s)-\s*\d+\b/.test(value) ||
  /\bmenos\s+(?:\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i.test(value);

const sanitizeAgentItem = (
  item: TelegramDeliveryNoteDraft["items"][number]
): TelegramDeliveryNoteDraft["items"][number] => {
  const description = withoutCommonColor(item.description);
  return {
    ...item,
    description: description || item.description.trim(),
    color: normalizeAgentColor(item.color),
    pricingMode: "DIMENSIONS",
    customUnitPrice: null,
    saveAsSpecialPiece: false
  };
};

const singularSearchTerm = (value: string): string => {
  if (value.endsWith("les")) return value.slice(0, -2);
  if (value.endsWith("es")) return value.slice(0, -2);
  if (value.endsWith("s")) return value.slice(0, -1);
  return value;
};

export class TelegramDeliveryNoteAssistant {
  public constructor(
    private readonly sessions: TelegramDeliveryNoteSessionRepository,
    private readonly customers: CustomerLookup,
    private readonly parser: VoiceParser,
    private readonly calculatePrice: PriceCalculator,
    private readonly createDeliveryNote: DeliveryNoteCreator,
    private readonly options: TelegramDeliveryNoteAssistantOptions
  ) {}

  public async handle(input: TelegramAssistantInput): Promise<string[]> {
    const session = await this.sessions.getOrCreate(input.chatId, input.userId);
    if (input.updateId <= session.lastUpdateId) return [];

    if (isReset(input.text)) {
      await this.sessions.reset(input.chatId, input.userId, input.updateId);
      return [
        "Borrador nuevo. Dicta el cliente y las piezas. Cuando termines, escribe YA ESTÁ."
      ];
    }

    if (isRejection(input.text)) {
      await this.sessions.reset(input.chatId, input.userId, input.updateId);
      return ["Propuesta y borrador cancelados. Puedes dictar un albarán nuevo."];
    }

    if (isHelp(input.text)) {
      await this.sessions.markProcessed(session.id, input.updateId);
      return [HELP_TEXT];
    }

    if (isConfirmation(input.text)) {
      return this.confirm(session, input.updateId);
    }

    if (isFinish(input.text)) {
      return this.prepare(session, input.updateId);
    }

    if (session.status === "PROPOSAL_READY") {
      await this.sessions.markProcessed(session.id, input.updateId);
      return [
        "Hay una propuesta pendiente. Responde SI para confirmarla o /new para descartarla y empezar de nuevo."
      ];
    }

    if (session.status !== "COLLECTING") {
      await this.sessions.markProcessed(session.id, input.updateId);
      return ["Este flujo ya terminó o quedó bloqueado. Envía /new para empezar otro."];
    }

    if (containsNegativeQuantity(input.text)) {
      await this.sessions.markProcessed(session.id, input.updateId);
      return ["La cantidad debe ser mayor que cero. Indica una cantidad positiva."];
    }

    const draftCommand = await this.tryHandleDraftCommand(session, input);
    if (draftCommand) return draftCommand;

    try {
      const parsed = await this.parser.execute(input.text);
      const draft: TelegramDeliveryNoteDraft = {
        customerName: parsed.customerName ?? session.draft.customerName,
        date: parsed.date ?? session.draft.date,
        notes: parsed.notes ?? session.draft.notes,
        items: [
          ...session.draft.items.map(sanitizeAgentItem),
          ...parsed.items.map(sanitizeAgentItem)
        ]
      };
      await this.sessions.saveDraft(session.id, input.updateId, draft);
      return [
        `Anotado: ${draft.items.length} línea(s)${draft.customerName ? ` para ${draft.customerName}` : ""}. Envía más piezas o escribe YA ESTÁ.`
      ];
    } catch {
      await this.sessions.markProcessed(session.id, input.updateId);
      return [
        "No pude convertir ese mensaje en una pieza. Repítelo indicando descripción, color, cantidad y medidas. El precio lo calcula la API."
      ];
    }
  }

  private async tryHandleDraftCommand(
    session: TelegramDeliveryNoteSession,
    input: TelegramAssistantInput
  ): Promise<string[] | null> {
    const normalized = normalizeText(input.text);
    const items = session.draft.items.map(sanitizeAgentItem);

    const quantityCommand = normalized.match(
      /\b(?:cambia|corrige|pon|establece)\b.*\bcantidad\b(?:\s+de\s+(\w+))?\s+a\s+(\w+)/
    );
    if (quantityCommand) {
      const previousQuantity = parsePositiveInteger(quantityCommand[1]);
      const nextQuantity = parsePositiveInteger(quantityCommand[2]);
      if (!nextQuantity) {
        await this.sessions.markProcessed(session.id, input.updateId);
        return ["La cantidad debe ser un número entero mayor que cero."];
      }
      const candidates = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => previousQuantity == null || item.quantity === previousQuantity);
      if (candidates.length !== 1) {
        await this.sessions.markProcessed(session.id, input.updateId);
        return ["No sé qué línea corregir. Indica también la descripción de la pieza."];
      }
      const target = candidates[0];
      if (!target) return null;
      items[target.index] = { ...target.item, quantity: nextQuantity };
      await this.sessions.saveDraft(session.id, input.updateId, {
        ...session.draft,
        items
      });
      return [`Cantidad corregida a ${nextQuantity} en ${target.item.description}.`];
    }

    const requestedTexture = extractRequestedTexture(input.text);
    if (requestedTexture && isShortTextureCorrection(input.text) && items.length > 0) {
      const requestedColor = extractRequestedColor(input.text);
      const candidates = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) =>
          requestedColor == null || normalizeAgentColor(item.color) === requestedColor
        );
      const target = candidates.length === 1
        ? candidates[0]
        : items.length === 1
          ? { item: items[0]!, index: 0 }
          : null;
      if (!target) {
        await this.sessions.markProcessed(session.id, input.updateId);
        return ["No sé qué línea necesita ese acabado. Indica también la descripción de la pieza."];
      }
      items[target.index] = {
        ...target.item,
        color: requestedColor ?? target.item.color,
        texture: requestedTexture
      };
      await this.sessions.saveDraft(session.id, input.updateId, {
        ...session.draft,
        items
      });
      return [
        `Acabado corregido a ${requestedTexture} en ${target.item.description}.`
      ];
    }

    if (/\bcolor\b/.test(normalized)) {
      const requestedColor = extractRequestedColor(input.text);
      const oldColorWord = normalized.match(/\bno\s+es\s+(\w+)/)?.[1];
      const oldColor = oldColorWord ? normalizeAgentColor(oldColorWord) : null;
      const candidates = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) =>
          oldColor ? normalizeAgentColor(item.color) === oldColor : item.color == null
        );
      const target = candidates.length === 1
        ? candidates[0]
        : items.length === 1
          ? { item: items[0]!, index: 0 }
          : null;
      if (requestedColor && target) {
        items[target.index] = {
          ...target.item,
          color: requestedColor,
          description: withoutCommonColor(target.item.description)
        };
        await this.sessions.saveDraft(session.id, input.updateId, {
          ...session.draft,
          items
        });
        return [`Color corregido a ${requestedColor} en ${target.item.description}.`];
      }
      if (requestedColor && candidates.length === 0) {
        await this.sessions.markProcessed(session.id, input.updateId);
        return ["No sé qué línea necesita ese color. Indica también la descripción de la pieza."];
      }
    }

    const removeCommand = normalized.match(
      /^\b(?:quita|quitar|elimina|eliminar)\b\s+(?:los|las|el|la)?\s*(\w+)/
    );
    if (removeCommand?.[1]) {
      const term = singularSearchTerm(removeCommand[1]);
      const remaining = items.filter(
        (item) => !normalizeText(item.description).includes(term)
      );
      if (remaining.length === items.length) {
        await this.sessions.markProcessed(session.id, input.updateId);
        return [`No encontré ninguna línea que coincida con "${removeCommand[1]}".`];
      }
      await this.sessions.saveDraft(session.id, input.updateId, {
        ...session.draft,
        items: remaining
      });
      return [`Línea eliminada. Quedan ${remaining.length} línea(s) en el borrador.`];
    }

    const customerCommand = normalized.match(
      /^\b(?:cambia|corrige|pon)\b(?:\s+el)?\s+cliente(?:\s+a)?\s+(.+)$/
    );
    const customerOnly = normalized.match(
      /^(?:el\s+)?cliente(?:\s+correcto)?\s+es\s+(.+)$/
    );
    {
      const customers = await this.customers.findAll();
      const requestedName = customerCommand?.[1] ?? customerOnly?.[1] ?? normalized;
      const exactCustomer = customers.find(
        (candidate) => normalizeText(candidate.name) === normalized
      );
      const requestedCustomer = customers.find(
        (candidate) => normalizeText(candidate.name) === normalizeText(requestedName)
      );
      const currentCustomer = findCustomer(customers, session.draft.customerName);
      const mentionedCustomers =
        session.draft.customerName != null && currentCustomer == null
          ? customers.filter((candidate) =>
              ` ${normalized} `.includes(` ${normalizeText(candidate.name)} `)
            )
          : [];
      const mentionedCustomer =
        mentionedCustomers.length === 1 ? mentionedCustomers[0] : null;
      const customer = exactCustomer ?? requestedCustomer ?? mentionedCustomer;
      if (customer) {
        await this.sessions.saveDraft(session.id, input.updateId, {
          ...session.draft,
          customerName: customer.name,
          items
        });
        return [`Cliente corregido a ${customer.name}. Se conservaron ${items.length} línea(s).`];
      }
      if (customerCommand?.[1] || customerOnly?.[1]) {
        await this.sessions.markProcessed(session.id, input.updateId);
        return ["No encontré ese cliente. Indica su nombre exacto sin borrar las piezas."];
      }
    }

    return null;
  }

  private async prepare(
    session: TelegramDeliveryNoteSession,
    updateId: number
  ): Promise<string[]> {
    if (session.status !== "COLLECTING") {
      await this.sessions.markProcessed(session.id, updateId);
      return ["No hay un borrador abierto. Envía /new para empezar."];
    }
    if (session.draft.items.length === 0) {
      await this.sessions.markProcessed(session.id, updateId);
      return ["El borrador no contiene piezas todavía."];
    }

    const customers = await this.customers.findAll();
    const customer = findCustomer(customers, session.draft.customerName);
    if (!customer) {
      await this.sessions.markProcessed(session.id, updateId);
      return [
        "No pude identificar un único cliente. Indica ahora su nombre exacto; conservaré las piezas del borrador."
      ];
    }

    const items: DeliveryNoteItemDraft[] = [];
    const errors: string[] = [];
    for (const parsedItem of session.draft.items) {
      const resolved = toDraftItem(customer, sanitizeAgentItem(parsedItem));
      if (resolved.error) errors.push(resolved.error);
      if (resolved.item) items.push(resolved.item);
    }
    if (errors.length > 0) {
      await this.sessions.markProcessed(session.id, updateId);
      return ["Faltan datos:\n" + errors.map((error) => `- ${error}`).join("\n")];
    }

    const lines = items.map((item) => ({
      item,
      ...this.calculatePrice.execute(item, customer)
    }));
    const totalAmount =
      Math.round(lines.reduce((sum, line) => sum + line.totalPrice, 0) * 100) / 100;
    const proposal: TelegramDeliveryNoteProposal = {
      customerId: customer.id,
      customerName: customer.name,
      date: session.draft.date ?? new Date().toISOString().slice(0, 10),
      notes: session.draft.notes,
      lines,
      totalAmount,
      preparedAt: new Date().toISOString()
    };
    const text = proposalText(proposal);
    await this.sessions.saveProposal(
      session.id,
      updateId,
      proposal,
      text,
      new Date(Date.now() + this.options.proposalTtlMs)
    );
    return [text];
  }

  private async confirm(
    session: TelegramDeliveryNoteSession,
    updateId: number
  ): Promise<string[]> {
    if (
      session.status !== "PROPOSAL_READY" ||
      !session.proposal ||
      !session.proposalExpiresAt ||
      session.proposalExpiresAt.getTime() <= Date.now()
    ) {
      await this.sessions.markProcessed(session.id, updateId);
      return ["No hay una propuesta vigente para confirmar. Envía YA ESTÁ o /new."];
    }

    if (!this.options.writesEnabled) {
      await this.sessions.markProcessed(session.id, updateId);
      return [
        "Confirmación validada en modo simulación de staging. No se creó ningún albarán."
      ];
    }

    const claimed = await this.sessions.claimProposalForCreation(
      session.id,
      updateId,
      new Date()
    );
    if (!claimed?.proposal) {
      return ["La propuesta ya fue utilizada, expiró o está siendo procesada. No se reintentará."];
    }

    try {
      const customer = await this.customers.findById(claimed.proposal.customerId);
      if (!customer || customer.name !== claimed.proposal.customerName) {
        await this.sessions.markBlocked(claimed.id);
        return ["El cliente cambió desde la propuesta. No se creó nada; envía /new."];
      }

      const safeItems = claimed.proposal.lines.map((line) => ({
        ...line.item,
        pricingMode: "DIMENSIONS" as const,
        customUnitPrice: null,
        saveAsSpecialPiece: false
      }));
      const repriced = safeItems.map((item) =>
        this.calculatePrice.execute(item, customer)
      );
      const pricesChanged = repriced.some(
        (price, index) =>
          !sameMoney(price.unitPrice, claimed.proposal!.lines[index]!.unitPrice) ||
          !sameMoney(price.totalPrice, claimed.proposal!.lines[index]!.totalPrice)
      );
      if (pricesChanged) {
        await this.sessions.markBlocked(claimed.id);
        return ["Los precios cambiaron desde la propuesta. No se creó nada; prepara una nueva."];
      }

      const deliveryNote = await this.createDeliveryNote.execute({
        customerId: customer.id,
        date: new Date(claimed.proposal.date),
        notes: claimed.proposal.notes,
        status: "DRAFT",
        items: safeItems
      });
      await this.sessions.markCreated(claimed.id, deliveryNote.id);
      return [
        `Hecho. ${deliveryNote.number} creado en DRAFT. Total: ${formatMoney(deliveryNote.totalAmount)}.`
      ];
    } catch {
      await this.sessions.markBlocked(claimed.id);
      return [
        "La creación no pudo verificarse. El flujo quedó bloqueado y no se reintentará automáticamente."
      ];
    }
  }
}
