import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowPathIcon,
  DocumentArrowDownIcon
} from "@heroicons/react/24/outline";
import {
  downloadInvoicePdf,
  listInvoices,
  reconcileInvoice
} from "@/features/invoices/invoiceApi";
import {
  invoiceCanReconcile,
  invoiceHasCustomerDataRejection,
  invoiceNeedsPolling
} from "@/features/invoices/invoiceStatus";
import type { Invoice } from "@/features/invoices/invoiceTypes";
import { ApiError } from "@/infrastructure/api/apiClient";

const localStateLabel: Record<Invoice["localState"], string> = {
  CREATING: "Creando",
  CREATED_REMOTE: "Creada en Odoo",
  LINKED: "Enlazada",
  RECONCILING: "Conciliando",
  FAILED: "Requiere atención"
};

const verifactuLabel: Record<Invoice["verifactuState"], string> = {
  NOT_SENT: "No enviada",
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada"
};

export const InvoicesPage = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["invoices"],
    queryFn: listInvoices,
    refetchInterval: ({ state }) =>
      state.data?.invoices.some(invoiceNeedsPolling) ? 5_000 : false
  });
  const reconcile = useMutation({
    mutationFn: reconcileInvoice,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["invoices"] })
  });

  return (
    <section>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--epx-accent)]">
          Facturación
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Facturas</h2>
        <p className="mt-2 text-sm text-[var(--epx-text-muted)]">
          Estado local, Odoo y VeriFactu. Los estados pendientes se actualizan automáticamente.
        </p>
      </div>

      {query.isLoading ? <p className="text-[var(--epx-text-muted)]">Cargando facturas…</p> : null}
      {query.error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {query.error instanceof ApiError ? query.error.message : "No se pudieron cargar las facturas"}
        </p>
      ) : null}
      <div className="grid gap-4">
        {query.data?.invoices.map((invoice) => (
          <article
            className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5"
            key={invoice.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  {invoice.number ?? "Factura en proceso"}
                </p>
                <p className="mt-1 text-sm text-[var(--epx-text-muted)]">
                  {invoice.customer.legalName} · {invoice.customer.vat}
                </p>
              </div>
              <p className="text-xl font-semibold text-white">{invoice.total} €</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1">{localStateLabel[invoice.localState]}</span>
              <span className="rounded-full bg-[color:rgb(255_149_0_/_0.16)] px-3 py-1 text-[var(--epx-accent)]">
                VeriFactu: {verifactuLabel[invoice.verifactuState]}
              </span>
            </div>
            {invoice.lastErrorMessage ? (
              <p className="mt-3 text-sm text-red-300">{invoice.lastErrorMessage}</p>
            ) : null}
            {invoiceHasCustomerDataRejection(invoice) ? (
              <p className="mt-2 text-sm text-[var(--epx-text-muted)]">
                Corrige la ficha fiscal del cliente y vuelve a facturar los mismos albaranes.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {invoiceCanReconcile(invoice) ? (
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white disabled:opacity-40"
                  disabled={reconcile.isPending}
                  onClick={() => reconcile.mutate(invoice.id)}
                  type="button"
                >
                  <ArrowPathIcon className="h-4 w-4" /> Conciliar
                </button>
              ) : null}
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--epx-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                disabled={!invoice.pdfAvailable}
                onClick={() => void downloadInvoicePdf(invoice)}
                type="button"
              >
                <DocumentArrowDownIcon className="h-4 w-4" /> Descargar PDF
              </button>
            </div>
          </article>
        ))}
      </div>
      {query.data?.invoices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-[var(--epx-text-muted)]">
          Todavía no hay facturas.
        </p>
      ) : null}
    </section>
  );
};
