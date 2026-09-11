import { describe, expect, it, vi } from "vitest";
import type { Customer } from "../../domain/entities/Customer.js";
import type { DeliveryNote } from "../../domain/entities/DeliveryNote.js";
import type { ParsedVoiceAlbaran } from "../../domain/ports/VoiceAlbaranParser.js";
import type {
  TelegramDeliveryNoteDraft,
  TelegramDeliveryNoteProposal,
  TelegramDeliveryNoteSession,
  TelegramDeliveryNoteSessionRepository
} from "../../domain/repositories/TelegramDeliveryNoteSessionRepository.js";
import { TelegramDeliveryNoteAssistant } from "./telegramDeliveryNoteAssistant.js";

const customer: Customer = {
  id: "customer-1",
  name: "Cliente Uno",
  email: null,
  phone: null,
  address: null,
  notes: null,
  vat: null,
  legalName: null,
  fiscalStreet: null,
  fiscalStreet2: null,
  fiscalCity: null,
  fiscalZip: null,
  fiscalProvince: null,
  fiscalCountryCode: null,
  paymentTermCode: null,
  externalPartnerId: null,
  active: true,
  pricePerLinearMeter: 10,
  pricePerSquareMeter: 20,
  minimumRate: 5,
  grosorPrecio: null,
  specialPieces: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

const emptyDraft = (): TelegramDeliveryNoteDraft => ({
  customerName: null,
  date: null,
  notes: null,
  items: []
});

class MemorySessions implements TelegramDeliveryNoteSessionRepository {
  public session: TelegramDeliveryNoteSession = {
    id: "session-1",
    chatId: "chat-1",
    userId: "user-1",
    lastUpdateId: 0,
    status: "COLLECTING",
    draft: emptyDraft(),
    proposal: null,
    proposalText: null,
    proposalExpiresAt: null,
    deliveryNoteId: null
  };

  public async getOrCreate(): Promise<TelegramDeliveryNoteSession> {
    return this.session;
  }

  public async reset(_chatId: string, _userId: string, updateId: number) {
    this.session = {
      ...this.session,
      lastUpdateId: updateId,
      status: "COLLECTING",
      draft: emptyDraft(),
      proposal: null,
      proposalText: null,
      proposalExpiresAt: null,
      deliveryNoteId: null
    };
    return this.session;
  }

  public async markProcessed(_sessionId: string, updateId: number): Promise<void> {
    this.session.lastUpdateId = updateId;
  }

  public async saveDraft(
    _sessionId: string,
    updateId: number,
    draft: TelegramDeliveryNoteDraft
  ) {
    this.session = { ...this.session, lastUpdateId: updateId, draft };
    return this.session;
  }

  public async saveProposal(
    _sessionId: string,
    updateId: number,
    proposal: TelegramDeliveryNoteProposal,
    proposalText: string,
    expiresAt: Date
  ) {
    this.session = {
      ...this.session,
      lastUpdateId: updateId,
      status: "PROPOSAL_READY",
      proposal,
      proposalText,
      proposalExpiresAt: expiresAt
    };
    return this.session;
  }

  public async claimProposalForCreation(
    _sessionId: string,
    updateId: number,
    now: Date
  ) {
    if (
      this.session.status !== "PROPOSAL_READY" ||
      this.session.lastUpdateId >= updateId ||
      !this.session.proposalExpiresAt ||
      this.session.proposalExpiresAt <= now
    ) return null;
    this.session = { ...this.session, status: "CREATING", lastUpdateId: updateId };
    return this.session;
  }

  public async markCreated(_sessionId: string, deliveryNoteId: string): Promise<void> {
    this.session.status = "CREATED";
    this.session.deliveryNoteId = deliveryNoteId;
  }

  public async markBlocked(): Promise<void> {
    this.session.status = "BLOCKED";
  }
}

const parsed: ParsedVoiceAlbaran = {
  customerName: "Cliente Uno",
  date: "2026-09-09",
  notes: null,
  items: [{
    description: "barandilla",
    color: "negro",
    specialPieceIntent: false,
    customUnitPrice: null,
    pricingMode: "DIMENSIONS",
    texture: "NORMAL",
    linearMeters: 2,
    squareMeters: null,
    hasThickness: false,
    hasPrimer: false,
    saveAsSpecialPiece: false,
    quantity: 2
  }]
};

const createdNote: DeliveryNote = {
  id: "note-1",
  number: "2026-0001",
  customerId: customer.id,
  customerName: customer.name,
  status: "DRAFT",
  notes: null,
  totalAmount: 40,
  date: new Date("2026-09-09"),
  items: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

const buildAssistant = (
  writesEnabled: boolean,
  parsedResult = parsed,
  customerList: Customer[] = [customer]
) => {
  const sessions = new MemorySessions();
  const create = vi.fn(async () => createdNote);
  const parser = { execute: vi.fn(async () => parsedResult) };
  const calculate = {
    execute: vi.fn(() => ({ unitPrice: 20, totalPrice: 40 }))
  };
  const assistant = new TelegramDeliveryNoteAssistant(
    sessions,
    {
      findAll: async () => customerList,
      findById: async (id: string) =>
        customerList.find((entry) => entry.id === id) ?? null
    },
    parser,
    calculate,
    { execute: create },
    { proposalTtlMs: 60_000, writesEnabled }
  );
  return { assistant, sessions, create, parser, calculate };
};

describe("TelegramDeliveryNoteAssistant", () => {
  it("muestra un manual breve con /start sin crear ni modificar un albarán", async () => {
    const { assistant, sessions, create } = buildAssistant(true);

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "/start"
    });

    expect(result[0]).toContain("Agente de Albaranes de Epoxiron");
    expect(result[0]).toContain("/new");
    expect(result[0]).toContain("/especiales");
    expect(result[0]).toContain("YA ESTÁ");
    expect(result[0]).toContain("Nada se crea hasta que respondas SI");
    expect(create).not.toHaveBeenCalled();
    expect(sessions.session.draft.items).toHaveLength(0);
  });

  it("muestra las piezas especiales de un cliente sin modificar el borrador", async () => {
    const specialCustomer: Customer = {
      ...customer,
      name: "DITRAMETAL S.L.",
      specialPieces: [
        { name: "PUERTA 9003 500X800", price: 3.8 },
        { name: "TUBO 9005+7024 2.02MLIN", price: 6.26 }
      ]
    };
    const { assistant, sessions, parser } = buildAssistant(false, parsed, [specialCustomer]);

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "/especiales Ditrametal"
    });

    expect(result[0]).toContain("PIEZAS ESPECIALES · DITRAMETAL S.L.");
    expect(result[0]).toContain("PUERTA 9003 500X800 — 3,80");
    expect(result[0]).toContain("TUBO 9005+7024 2.02MLIN — 6,26");
    expect(sessions.session.draft).toEqual(emptyDraft());
    expect(parser.execute).not.toHaveBeenCalled();
  });

  it("usa el cliente del borrador y pagina el catálogo de piezas especiales", async () => {
    const specialCustomer: Customer = {
      ...customer,
      specialPieces: Array.from({ length: 21 }, (_, index) => ({
        name: `PIEZA ${String(index + 1).padStart(2, "0")}`,
        price: index + 1
      }))
    };
    const { assistant, sessions } = buildAssistant(false, parsed, [specialCustomer]);
    sessions.session.draft = { ...emptyDraft(), customerName: customer.name };

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "/especiales pagina 2"
    });

    expect(result[0]).toContain("21. PIEZA 21");
    expect(result[0]).toContain("Página 2/2 · 21 pieza(s).");
    expect(sessions.session.draft.customerName).toBe(customer.name);
  });

  it("permite consultar especiales aunque haya una propuesta pendiente", async () => {
    const specialCustomer: Customer = {
      ...customer,
      specialPieces: [{ name: "PUERTA ESPECIAL", price: 7.5 }]
    };
    const { assistant, sessions } = buildAssistant(false, parsed, [specialCustomer]);
    sessions.session.status = "PROPOSAL_READY";

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "/especiales Cliente Uno"
    });

    expect(result[0]).toContain("PUERTA ESPECIAL");
    expect(sessions.session.status).toBe("PROPOSAL_READY");
  });

  it("prepara la propuesta pero no escribe en modo simulación", async () => {
    const { assistant, sessions, create } = buildAssistant(false);

    await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 1, text: "/new" });
    await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 2, text: "dos barandillas negras de dos metros" });
    const proposal = await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 3, text: "YA ESTÁ" });
    const result = await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 4, text: "SI" });

    expect(proposal[0]).toContain("PROPUESTA DE ALBARÁN");
    expect(proposal[0]).toContain("40,00");
    expect(result[0]).toContain("modo simulación");
    expect(create).not.toHaveBeenCalled();
    expect(sessions.session.status).toBe("PROPOSAL_READY");
  });

  it("crea una sola vez en DRAFT después de SI cuando se habilitan escrituras", async () => {
    const { assistant, sessions, create } = buildAssistant(true);

    await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 1, text: "pieza" });
    await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 2, text: "YA ESTÁ" });
    const result = await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 3, text: "SI" });
    const duplicate = await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 3, text: "SI" });

    expect(result[0]).toContain("creado en DRAFT");
    expect(duplicate).toEqual([]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(sessions.session.status).toBe("CREATED");
  });

  it("ignora cualquier precio dictado y fuerza el cálculo por dimensiones", async () => {
    const pricedByVoice = {
      ...parsed,
      items: [{
        ...parsed.items[0]!,
        pricingMode: "UNIT" as const,
        customUnitPrice: 99
      }]
    };
    const { assistant, calculate } = buildAssistant(false, pricedByVoice);

    await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 1, text: "pieza a 99 euros" });
    const proposal = await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 2, text: "YA ESTÁ" });

    expect(calculate.execute).toHaveBeenCalledWith(expect.objectContaining({
      pricingMode: "DIMENSIONS",
      customUnitPrice: null
    }), customer);
    expect(proposal[0]).not.toContain("99,00");
  });

  it("reconoce una pieza especial única por nombre, color y medidas", async () => {
    const specialCustomer: Customer = {
      ...customer,
      specialPieces: [{ name: "PUERTA 9003 500X800", price: 3.8 }]
    };
    const specialParsed: ParsedVoiceAlbaran = {
      ...parsed,
      items: [{
        ...parsed.items[0]!,
        description: "UNA PUERTA 50X80",
        color: "RAL 9003",
        widthMm: 500,
        heightMm: 800,
        linearMeters: null,
        squareMeters: null,
        quantity: 1
      }]
    };
    const { assistant, calculate } = buildAssistant(
      false,
      specialParsed,
      [specialCustomer]
    );

    await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "una puerta de 500 x 800 RAL 9003"
    });
    const proposal = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 2,
      text: "YA ESTÁ"
    });

    expect(proposal[0]).toContain("PUERTA 9003 500X800");
    expect(proposal[0]).toContain("PIEZA ESPECIAL");
    expect(calculate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ description: "PUERTA 9003 500X800" }),
      specialCustomer
    );
  });

  it("no elige automáticamente entre varias piezas especiales posibles", async () => {
    const specialCustomer: Customer = {
      ...customer,
      specialPieces: [
        { name: "GONDOLA 9005 2000X770", price: 38.56 },
        { name: "GONDOLA 9005 1900X700", price: 35 }
      ]
    };
    const ambiguousParsed: ParsedVoiceAlbaran = {
      ...parsed,
      items: [{
        ...parsed.items[0]!,
        description: "GONDOLA",
        color: "RAL 9005",
        linearMeters: null,
        squareMeters: null,
        quantity: 1
      }]
    };
    const { assistant, sessions } = buildAssistant(
      false,
      ambiguousParsed,
      [specialCustomer]
    );

    await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "una góndola RAL 9005"
    });
    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 2,
      text: "YA ESTÁ"
    });

    expect(result[0]).toContain("coincide con varias piezas especiales");
    expect(result[0]).toContain("1. GONDOLA 9005 2000X770");
    expect(result[0]).toContain("GONDOLA 9005 2000X770");
    expect(sessions.session.status).toBe("COLLECTING");

    const selected = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 3,
      text: "GONDOLA 9005 2000X770"
    });
    const proposal = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 4,
      text: "YA ESTÁ"
    });

    expect(selected[0]).toContain("Pieza especial seleccionada");
    expect(sessions.session.draft.items).toHaveLength(1);
    expect(proposal[0]).toContain("PIEZA ESPECIAL");
  });

  it("reconoce una pieza especial única por metros lineales", async () => {
    const specialCustomer: Customer = {
      ...customer,
      specialPieces: [{ name: "TUBO 9005+7024 2.02MLIN", price: 6.26 }]
    };
    const specialParsed: ParsedVoiceAlbaran = {
      ...parsed,
      items: [{
        ...parsed.items[0]!,
        description: "TUBO 2,02M",
        color: "RAL 9005",
        linearMeters: 2.02,
        squareMeters: null,
        quantity: 1
      }]
    };
    const { assistant, calculate } = buildAssistant(
      false,
      specialParsed,
      [specialCustomer]
    );

    await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "un tubo de 2,02 metros RAL 9005"
    });
    const proposal = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 2,
      text: "YA ESTÁ"
    });

    expect(proposal[0]).toContain("TUBO 9005+7024 2.02MLIN");
    expect(proposal[0]).toContain("PIEZA ESPECIAL");
    expect(calculate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ description: "TUBO 9005+7024 2.02MLIN" }),
      specialCustomer
    );
  });

  it("corrige cantidad y color sin añadir líneas", async () => {
    const { assistant, sessions, parser } = buildAssistant(false);

    await assistant.handle({ chatId: "chat-1", userId: "user-1", updateId: 1, text: "dos piezas negras" });
    const quantity = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 2,
      text: "Cambia la cantidad de dos a cinco"
    });
    const color = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 3,
      text: "El color no es negro, es blanco RAL 9010"
    });

    expect(quantity[0]).toContain("Cantidad corregida a 5");
    expect(color[0]).toContain("Color corregido a RAL 9010");
    expect(sessions.session.draft.items).toHaveLength(1);
    expect(sessions.session.draft.items[0]).toMatchObject({
      quantity: 5,
      color: "RAL 9010"
    });
    expect(parser.execute).toHaveBeenCalledTimes(1);
  });

  it("elimina una línea y permite cambiar el cliente conservando las piezas", async () => {
    const secondCustomer: Customer = {
      ...customer,
      id: "customer-2",
      name: "Cero Creativo"
    };
    const { assistant, sessions } = buildAssistant(false, parsed, [customer, secondCustomer]);
    sessions.session.draft = {
      ...emptyDraft(),
      customerName: customer.name,
      items: [
        parsed.items[0]!,
        { ...parsed.items[0]!, description: "PERFIL 2M", quantity: 4 }
      ]
    };

    const removed = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "Quita los perfiles y deja solamente las chapas"
    });
    const changedCustomer = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 2,
      text: "Cambia el cliente a Cero Creativo"
    });

    expect(removed[0]).toContain("Línea eliminada");
    expect(changedCustomer[0]).toContain("Cliente corregido a Cero Creativo");
    expect(sessions.session.draft.items).toHaveLength(1);
    expect(sessions.session.draft.customerName).toBe("Cero Creativo");
  });

  it("completa el color pendiente con una respuesta corta", async () => {
    const { assistant, sessions } = buildAssistant(false);
    sessions.session.draft = {
      ...emptyDraft(),
      customerName: customer.name,
      items: [{ ...parsed.items[0]!, color: null }]
    };

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "El color es 9005"
    });

    expect(result[0]).toContain("Color corregido a RAL 9005");
    expect(sessions.session.draft.items[0]?.color).toBe("RAL 9005");
  });

  it("aplica una corrección corta de color y acabado sin crear otra línea", async () => {
    const { assistant, sessions, parser } = buildAssistant(false);
    sessions.session.draft = {
      ...emptyDraft(),
      customerName: customer.name,
      items: [parsed.items[0]!]
    };

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "9005 texturado"
    });

    expect(result[0]).toContain("Acabado corregido a TEXTURADO");
    expect(sessions.session.draft.items).toHaveLength(1);
    expect(sessions.session.draft.items[0]).toMatchObject({
      color: "RAL 9005",
      texture: "TEXTURADO"
    });
    expect(parser.execute).not.toHaveBeenCalled();
  });

  it("cancela con NO y limpia la propuesta pendiente", async () => {
    const { assistant, sessions } = buildAssistant(false);
    sessions.session.status = "PROPOSAL_READY";
    sessions.session.proposal = {
      customerId: customer.id,
      customerName: customer.name,
      date: "2026-09-09",
      notes: null,
      lines: [],
      totalAmount: 0,
      preparedAt: new Date().toISOString()
    };

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "No, cancélalo"
    });

    expect(result[0]).toContain("cancelados");
    expect(sessions.session.status).toBe("COLLECTING");
    expect(sessions.session.proposal).toBeNull();
  });

  it("rechaza cantidades negativas antes de llamar al parser", async () => {
    const { assistant, parser } = buildAssistant(false);

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "Menos dos chapas"
    });

    expect(result[0]).toContain("mayor que cero");
    expect(parser.execute).not.toHaveBeenCalled();
  });

  it("conserva las piezas cuando el cliente no existe y permite corregir solo el cliente", async () => {
    const unknownCustomer = { ...parsed, customerName: "TALLERES INVENTADOS" };
    const secondCustomer: Customer = {
      ...customer,
      id: "customer-2",
      name: "Cero Creativo"
    };
    const { assistant, sessions } = buildAssistant(
      false,
      unknownCustomer,
      [customer, secondCustomer]
    );

    await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "Cliente Talleres Inventados. Dos piezas."
    });
    const finish = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 2,
      text: "YA ESTÁ"
    });
    const correction = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 3,
      text: "creativo, cero creativo"
    });

    expect(finish[0]).toContain("conservaré las piezas");
    expect(correction[0]).toContain("Cliente corregido a Cero Creativo");
    expect(sessions.session.draft.items).toHaveLength(1);
    expect(sessions.session.draft.customerName).toBe("Cero Creativo");
  });

  it("bloquea una propuesta antigua que contenía un precio manual", async () => {
    const { assistant, sessions, create } = buildAssistant(true);
    sessions.session.status = "PROPOSAL_READY";
    sessions.session.proposalExpiresAt = new Date(Date.now() + 60_000);
    sessions.session.proposal = {
      customerId: customer.id,
      customerName: customer.name,
      date: "2026-09-09",
      notes: null,
      lines: [{
        item: {
          description: "CHAPA 100X50",
          color: "RAL 9005",
          texture: "NORMAL",
          pricingMode: "UNIT",
          customUnitPrice: 99,
          linearMeters: null,
          squareMeters: null,
          thickness: null,
          primer: false,
          quantity: 1,
          saveAsSpecialPiece: false
        },
        unitPrice: 99,
        totalPrice: 99
      }],
      totalAmount: 99,
      preparedAt: new Date().toISOString()
    };

    const result = await assistant.handle({
      chatId: "chat-1",
      userId: "user-1",
      updateId: 1,
      text: "SI"
    });

    expect(result[0]).toContain("precios cambiaron");
    expect(create).not.toHaveBeenCalled();
    expect(sessions.session.status).toBe("BLOCKED");
  });
});
