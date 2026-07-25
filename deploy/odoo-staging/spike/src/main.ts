import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getConfig } from "./config.js";
import {
  Json2Client,
  type OdooClient,
  type OdooRecord,
  type OdooValue,
  XmlRpcClient
} from "./clients.js";

type Transport = "json2" | "xmlrpc";

interface Observation {
  observedAt: string;
  state: OdooValue | undefined;
  fields: Record<string, OdooValue>;
}

interface Report {
  startedAt: string;
  finishedAt?: string;
  transport: Transport;
  writeMode: boolean;
  version?: string;
  userId?: number | null;
  partnerFields: string[];
  invoiceFields: string[];
  verifactuFields: string[];
  idempotencyFieldAvailable: boolean;
  samplePartnerIds: number[];
  taxId?: number;
  invoiceId?: number;
  invoiceReference?: string;
  observations: Observation[];
  pdfPath?: string;
  warnings: string[];
  error?: { name: string; message: string };
}

const transportArgument = process.argv.find((value) => value.startsWith("--transport="));
const transportValue = transportArgument?.split("=", 2)[1];
if (transportValue !== "json2" && transportValue !== "xmlrpc") {
  throw new Error("Use --transport=json2 o --transport=xmlrpc");
}
const transport: Transport = transportValue;
const config = getConfig();
const confirmed = process.argv.includes("--confirm-write");
const writeMode = config.SPIKE_ALLOW_WRITES && confirmed;
const report: Report = {
  startedAt: new Date().toISOString(),
  transport,
  writeMode,
  partnerFields: [],
  invoiceFields: [],
  verifactuFields: [],
  idempotencyFieldAvailable: false,
  samplePartnerIds: [],
  observations: [],
  warnings: []
};

const client: OdooClient =
  transport === "json2" ? new Json2Client(config) : new XmlRpcClient(config);

const fieldsGet = async (model: string): Promise<Record<string, OdooValue>> =>
  client.call(model, "fields_get", {
    attributes: ["string", "type", "required", "readonly"]
  });

const observe = async (invoiceId: number): Promise<Observation> => {
  const records = await client.call<OdooRecord[]>("account.move", "read", {
    ids: [invoiceId],
    fields: ["state", ...report.verifactuFields]
  });
  const record = records[0];
  if (!record) {
    throw new Error(`No se pudo releer account.move ${invoiceId}`);
  }
  return {
    observedAt: new Date().toISOString(),
    state: record.state,
    fields: Object.fromEntries(
      report.verifactuFields.map((field) => [field, record[field] ?? null])
    )
  };
};

const downloadPdf = async (invoiceId: number): Promise<Uint8Array> => {
  const login = await fetch(`${config.ODOO_URL}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { db: config.ODOO_DB, login: config.ODOO_USER, password: config.ODOO_API_KEY },
      id: randomUUID()
    })
  });
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  if (!login.ok || !cookie) {
    throw new Error(`No se pudo crear sesión web para PDF: HTTP ${login.status}`);
  }
  const response = await fetch(
    `${config.ODOO_URL}/report/pdf/account.report_invoice_with_payments/${invoiceId}`,
    { headers: { Cookie: cookie } }
  );
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/pdf")) {
    throw new Error(`Odoo no devolvió un PDF válido: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

try {
  if (config.SPIKE_ALLOW_WRITES !== confirmed) {
    report.warnings.push(
      "La escritura exige SPIKE_ALLOW_WRITES=true y --confirm-write; ejecución de solo lectura."
    );
  }
  const auth = await client.authenticate();
  report.version = auth.version;
  report.userId = auth.userId;

  report.partnerFields = Object.keys(await fieldsGet("res.partner")).sort();
  const invoiceFieldMap = await fieldsGet("account.move");
  report.invoiceFields = Object.keys(invoiceFieldMap).sort();
  report.verifactuFields = report.invoiceFields.filter((field) =>
    /(veri.?factu|qr|edi.*state|l10n_es)/i.test(field)
  );
  report.idempotencyFieldAvailable = "x_epoxiron_idempotency_key" in invoiceFieldMap;

  const partners = await client.call<OdooRecord[]>("res.partner", "search_read", {
    domain: [["is_company", "=", true]],
    fields: ["id", "name", "vat", "street", "city", "zip", "state_id", "country_id"],
    limit: 5,
    order: "id asc"
  });
  report.samplePartnerIds = partners.map((partner) => partner.id);

  const taxes = await client.call<OdooRecord[]>("account.tax", "search_read", {
    domain: [
      ["type_tax_use", "=", "sale"],
      ["amount", "=", config.ODOO_TEST_TAX_RATE],
      ["active", "=", true]
    ],
    fields: ["id", "name", "amount", "company_id"],
    limit: 1
  });
  report.taxId = taxes[0]?.id;

  if (writeMode) {
    if (!config.ODOO_TEST_PARTNER_ID || !report.taxId) {
      throw new Error("La escritura requiere ODOO_TEST_PARTNER_ID e IVA de ventas configurado");
    }
    const stamp = new Date().toISOString();
    const digest = createHash("sha256").update(`${stamp}:${randomUUID()}`).digest("hex").slice(0, 16);
    const reference = `EPOXIRON-SPIKE-${stamp.slice(0, 10)}-${digest}`;
    report.invoiceReference = reference;
    const values: Record<string, OdooValue> = {
      move_type: "out_invoice",
      partner_id: config.ODOO_TEST_PARTNER_ID,
      ref: reference,
      invoice_line_ids: [[0, 0, {
        name: "Prueba técnica Epoxiron - staging",
        quantity: 1,
        price_unit: config.ODOO_TEST_UNIT_PRICE,
        tax_ids: [[6, 0, [report.taxId]]]
      }]]
    };
    if (report.idempotencyFieldAvailable) {
      values.x_epoxiron_idempotency_key = reference;
    }
    report.invoiceId = await client.call<number>("account.move", "create", values);
    report.observations.push(await observe(report.invoiceId));
    await client.call("account.move", "action_post", { ids: [report.invoiceId] });
    report.observations.push(await observe(report.invoiceId));
    for (let attempt = 0; attempt < config.ODOO_POLL_ATTEMPTS; attempt += 1) {
      await new Promise<void>((done) => setTimeout(done, config.ODOO_POLL_INTERVAL_MS));
      report.observations.push(await observe(report.invoiceId));
    }
    const output = resolve(process.cwd(), "output");
    await mkdir(output, { recursive: true });
    const pdfPath = resolve(output, `${reference}.pdf`);
    await writeFile(pdfPath, await downloadPdf(report.invoiceId));
    report.pdfPath = pdfPath;
  } else {
    report.warnings.push("No se creó ninguna factura.");
  }
} catch (error) {
  const safeError = error instanceof Error ? error : new Error("Error desconocido");
  report.error = { name: safeError.name, message: safeError.message };
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  const output = resolve(process.cwd(), "output");
  await mkdir(output, { recursive: true });
  const file = resolve(
    output,
    `${report.startedAt.replace(/[:.]/g, "-")}-${transport}.json`
  );
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`Informe del spike: ${file}\n`);
}

