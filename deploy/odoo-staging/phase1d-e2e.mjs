import { PrismaClient } from "@prisma/client";

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const apiBaseUrl = process.env.PHASE1D_API_URL?.trim() || "http://127.0.0.1:3001";
const sharedSecret = requiredEnv("HERMES_SHARED_SECRET");
const odooUrl = requiredEnv("ODOO_URL").replace(/\/+$/, "");
const odooDatabase = requiredEnv("ODOO_DB");
const odooApiKey = requiredEnv("ODOO_API_KEY");
const testPartnerId = Number.parseInt(requiredEnv("ODOO_TEST_PARTNER_ID"), 10);
if (!Number.isInteger(testPartnerId) || testPartnerId <= 0) {
  throw new Error("ODOO_TEST_PARTNER_ID must be a positive integer");
}

const prisma = new PrismaClient();

const apiCall = async (path, init = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-hermes-secret": sharedSecret,
      ...(init.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`Epoxiron ${path}: ${message}`);
  }
  return { body, status: response.status };
};

const odooCall = async (model, method, payload) => {
  const response = await fetch(
    `${odooUrl}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`,
    {
      method: "POST",
      headers: {
        authorization: `bearer ${odooApiKey}`,
        "content-type": "application/json; charset=utf-8",
        "x-odoo-database": odooDatabase
      },
      body: JSON.stringify(payload)
    }
  );
  if (!response.ok) throw new Error(`Odoo ${model}.${method}: HTTP ${response.status}`);
  return response.json();
};

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const relationId = (value) =>
  Array.isArray(value) && Number.isInteger(value[0]) ? value[0] : null;
const relationLabel = (value) =>
  Array.isArray(value) && typeof value[1] === "string" ? value[1] : null;

const loadTestPartner = async () => {
  let records = await odooCall("res.partner", "read", {
    ids: [testPartnerId],
    fields: ["id", "name", "vat", "street", "street2", "city", "zip", "state_id", "country_id"]
  });
  let partner = Array.isArray(records) ? records[0] : null;
  if (!partner) throw new Error("Configured Odoo test partner was not found");
  if (!text(partner.vat)) {
    await odooCall("res.partner", "write", {
      ids: [testPartnerId],
      vals: { vat: "B00000000" }
    });
    records = await odooCall("res.partner", "read", {
      ids: [testPartnerId],
      fields: ["id", "name", "vat", "street", "street2", "city", "zip", "state_id", "country_id"]
    });
    partner = Array.isArray(records) ? records[0] : null;
    if (!partner) throw new Error("Configured Odoo test partner disappeared after fixture update");
  }

  const countryId = relationId(partner.country_id);
  const countries = countryId
    ? await odooCall("res.country", "read", { ids: [countryId], fields: ["code"] })
    : [];
  const countryCode = text(Array.isArray(countries) ? countries[0]?.code : null);
  const fiscal = {
    legalName: text(partner.name),
    vat: text(partner.vat),
    street: text(partner.street),
    street2: text(partner.street2),
    city: text(partner.city),
    zip: text(partner.zip),
    province: relationLabel(partner.state_id),
    countryCode
  };
  const missingFields = Object.entries(fiscal)
    .filter(([key, value]) => key !== "street2" && key !== "province" && !value)
    .map(([key]) => key);
  if (missingFields.length > 0) {
    throw new Error(`Configured Odoo test partner is missing: ${missingFields.join(", ")}`);
  }
  return fiscal;
};

const ensureLocalCustomer = async (fiscal) => {
  const existing = await prisma.customer.findFirst({
    where: { externalPartnerId: testPartnerId.toString() }
  });
  const data = {
    name: "CLIENTE E2E ODOO STAGING",
    legalName: fiscal.legalName,
    vat: fiscal.vat,
    fiscalStreet: fiscal.street,
    fiscalStreet2: fiscal.street2,
    fiscalCity: fiscal.city,
    fiscalZip: fiscal.zip,
    fiscalProvince: fiscal.province,
    fiscalCountryCode: fiscal.countryCode,
    externalPartnerId: testPartnerId.toString(),
    pricePerLinearMeter: 0,
    pricePerSquareMeter: 0,
    minimumRate: 0
  };
  return existing
    ? prisma.customer.update({ where: { id: existing.id }, data })
    : prisma.customer.create({ data });
};

const createReviewedNote = async (customerId, description, customUnitPrice) => {
  const result = await apiCall("/api/delivery-notes", {
    method: "POST",
    body: JSON.stringify({
      customerId,
      status: "REVIEWED",
      notes: "Ensayo automatizado Fase 1D en staging",
      items: [{
        description,
        color: "RAL 9005",
        texture: "NORMAL",
        pricingMode: "UNIT",
        customUnitPrice,
        quantity: 1
      }]
    })
  });
  return result.body.deliveryNote;
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const main = async () => {
  const fiscal = await loadTestPartner();
  const customer = await ensureLocalCustomer(fiscal);
  const recentThreshold = new Date(Date.now() - 60 * 60 * 1_000);
  const recoverable = await prisma.invoice.findFirst({
    where: {
      customerId: customer.id,
      createdAt: { gte: recentThreshold },
      verifactuState: { notIn: ["ACCEPTED", "REJECTED"] }
    },
    include: { deliveryNotes: true },
    orderBy: { createdAt: "desc" }
  });

  let runId;
  let deliveryNoteIds;
  let invoiceId;
  let invoice;
  let concurrentStatuses = [];
  if (recoverable) {
    runId = "recovery";
    deliveryNoteIds = recoverable.deliveryNotes.map((entry) => entry.deliveryNoteId);
    invoiceId = recoverable.id;
    invoice = (await apiCall(`/api/invoices/${invoiceId}`)).body.invoice;
    if (invoice.localState === "FAILED") {
      try {
        invoice = (await apiCall("/api/invoices", {
          method: "POST",
          body: JSON.stringify({ deliveryNoteIds, confirmed: true })
        })).body.invoice;
      } catch (error) {
        invoice = (await apiCall(`/api/invoices/${invoiceId}`)).body.invoice;
        const context = invoice.lastErrorCode === "ODOO_COMPANY_NOT_FOUND"
          ? await odooCall("res.users", "context_get", {})
          : null;
        let taxCandidates = null;
        if (invoice.lastErrorCode === "ODOO_TAX_AMBIGUOUS") {
          const userContext = await odooCall("res.users", "context_get", {});
          const users = await odooCall("res.users", "read", {
            ids: [userContext.uid],
            fields: ["company_id"]
          });
          const companyId = relationId(Array.isArray(users) ? users[0]?.company_id : null);
          taxCandidates = await odooCall("account.tax", "search_read", {
            domain: [
              ["type_tax_use", "=", "sale"],
              ["amount", "=", 21],
              ["active", "=", true],
              ["company_id", "=", companyId]
            ],
            fields: ["id", "name", "description", "price_include", "tax_group_id"]
          });
        }
        throw new Error(`Invoice resume failed: ${JSON.stringify({
          localState: invoice.localState,
          externalInvoicePresent: Boolean(invoice.externalInvoiceId),
          lastErrorCode: invoice.lastErrorCode,
          reconciliationAttempts: invoice.reconciliationAttempts,
          odooContext: context ? {
            companyId: context.company_id ?? null,
            allowedCompanyIds: context.allowed_company_ids ?? null,
            keys: Object.keys(context).sort()
          } : null,
          taxCandidates
        })}`, { cause: error });
      }
    }
  } else {
    runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const notes = [
      await createReviewedNote(customer.id, `Fase 1D ${runId} línea A`, 10.03),
      await createReviewedNote(customer.id, `Fase 1D ${runId} línea B`, 10.04)
    ];
    deliveryNoteIds = notes.map((note) => note.id);
    const payload = JSON.stringify({ deliveryNoteIds, confirmed: true });
    const settled = await Promise.allSettled(
      [1, 2].map(() => apiCall("/api/invoices", { method: "POST", body: payload }))
    );
    const successful = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    concurrentStatuses = settled.map((result) =>
      result.status === "fulfilled" ? result.value.status : "RECOVERABLE_ERROR"
    );
    const persisted = await prisma.invoice.findFirst({
      where: {
        deliveryNotes: { some: { deliveryNoteId: { in: deliveryNoteIds } } }
      },
      orderBy: { createdAt: "desc" }
    });
    invoiceId = successful[0]?.body.invoice.id ?? persisted?.id;
    if (!invoiceId) throw new Error("Concurrent requests did not reserve a local invoice");
    if (new Set(successful.map((result) => result.body.invoice.id)).size > 1) {
      throw new Error("Concurrent requests returned different invoices");
    }
    invoice = (await apiCall(`/api/invoices/${invoiceId}`)).body.invoice;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (invoice.verifactuState === "ACCEPTED" || invoice.verifactuState === "REJECTED") break;
    await delay(2_000);
    invoice = (await apiCall(`/api/invoices/${invoiceId}/reconcile`, { method: "POST" })).body.invoice;
  }
  if (invoice.localState !== "LINKED") {
    throw new Error(`Invoice recovery stopped: ${JSON.stringify({
      localState: invoice.localState,
      externalInvoicePresent: Boolean(invoice.externalInvoiceId),
      lastErrorCode: invoice.lastErrorCode,
      reconciliationAttempts: invoice.reconciliationAttempts
    })}`);
  }
  if (invoice.odooMoveState !== "POSTED") throw new Error(`Unexpected Odoo state: ${invoice.odooMoveState}`);
  if (invoice.verifactuState !== "ACCEPTED") {
    throw new Error(`Unexpected VeriFactu state: ${invoice.verifactuState}`);
  }
  if (invoice.subtotal !== "20.07" || invoice.taxAmount !== "4.21" || invoice.total !== "24.28") {
    throw new Error("Odoo authoritative amounts do not match global rounding expectations");
  }
  if (!invoice.verifactuQrValue || !invoice.pdfAvailable) {
    throw new Error("Accepted invoice is missing QR or PDF");
  }

  const repeated = await apiCall("/api/invoices", {
    method: "POST",
    body: JSON.stringify({ deliveryNoteIds, confirmed: true })
  });
  if (repeated.body.invoice.id !== invoiceId || repeated.status !== 200) {
    throw new Error("Idempotent replay did not return the existing invoice");
  }
  const localCount = await prisma.invoice.count({
    where: { deliveryNotes: { some: { deliveryNoteId: { in: deliveryNoteIds } } } }
  });
  if (localCount !== 1) throw new Error(`Expected one local invoice, found ${localCount}`);
  const persistedNotes = await prisma.deliveryNote.findMany({
    where: { id: { in: deliveryNoteIds } },
    select: { status: true }
  });
  if (persistedNotes.some((note) => note.status !== "INVOICED")) {
    throw new Error("One or more delivery notes were not locked as INVOICED");
  }

  const pdfResponse = await fetch(`${apiBaseUrl}/api/invoices/${invoiceId}/pdf`, {
    headers: { "x-hermes-secret": sharedSecret }
  });
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  if (!pdfResponse.ok || pdf.length < 5 || pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("Authenticated PDF endpoint did not return a valid PDF");
  }

  process.stdout.write(`${JSON.stringify({
    runId,
    invoiceId,
    externalInvoiceId: invoice.externalInvoiceId,
    number: invoice.number,
    localState: invoice.localState,
    odooMoveState: invoice.odooMoveState,
    verifactuState: invoice.verifactuState,
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    pdfBytes: pdf.length,
    concurrentStatuses,
    replayStatus: repeated.status,
    localInvoiceCount: localCount,
    deliveryNotesLocked: true
  }, null, 2)}\n`);
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
