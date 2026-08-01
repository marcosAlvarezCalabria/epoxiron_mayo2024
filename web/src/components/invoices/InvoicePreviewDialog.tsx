import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import type { InvoicePreviewResponse } from "@/features/invoices/invoiceTypes";

interface Props {
  data: InvoicePreviewResponse;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const money = (value: string) =>
  `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const InvoicePreviewDialog = ({ data, error, isSubmitting, onClose, onConfirm }: Props) => {
  const [reviewed, setReviewed] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element && element.scrollHeight <= element.clientHeight + 8) setReachedEnd(true);
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isSubmitting, onClose]);

  const { preview } = data;
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 p-0 backdrop-blur-sm sm:p-6" role="presentation">
      <section
        aria-labelledby="invoice-preview-title"
        aria-modal="true"
        className="mx-auto flex h-full max-w-5xl flex-col border border-neutral-600 bg-[#1c1b1b] text-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-700 p-4 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--epx-accent)]">Borrador de revisión — todavía no emitida</p>
            <h2 className="mt-1 text-xl font-semibold" id="invoice-preview-title">Revisión de la factura</h2>
            <p className="mt-2 text-sm text-neutral-300">Comprueba todas las líneas. Al emitirla se enviará a Odoo y no podrá editarse desde Epoxiron.</p>
          </div>
          <button aria-label="Cerrar revisión" disabled={isSubmitting} onClick={onClose} type="button">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          onScroll={(event) => {
            const element = event.currentTarget;
            if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24) setReachedEnd(true);
          }}
          ref={scrollRef}
        >
          <div className="grid gap-4 border-b border-neutral-700 pb-5 sm:grid-cols-2">
            <div><p className="text-xs uppercase text-neutral-400">Emisor</p><p className="mt-1 font-semibold">{preview.issuer.legalName}</p><p className="text-sm text-neutral-300">{preview.issuer.vat} · {preview.issuer.street}, {preview.issuer.zip} {preview.issuer.city}</p></div>
            <div><p className="text-xs uppercase text-neutral-400">Cliente</p><p className="mt-1 font-semibold">{preview.customer.legalName}</p><p className="text-sm text-neutral-300">{preview.customer.vat} · {preview.customer.street}, {preview.customer.zip} {preview.customer.city}</p></div>
          </div>
          <div className="mt-5 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
            <p>Fecha prevista: {new Date(preview.issueDate).toLocaleDateString("es-ES")}</p>
            <p>Serie prevista: {preview.series ?? "Sin serie configurada"}</p>
            <p>Condición de pago: {preview.customer.paymentTermCode ?? "No configurada"}</p>
            <p>{preview.deliveryNoteCount} albarán(es) · {preview.lineCount} línea(s)</p>
          </div>
          <p className="mt-3 text-sm text-neutral-300">Albaranes: {preview.deliveryNotes.map((note) => note.number).join(", ")}</p>
          {preview.warnings.map((warning) => <p className="mt-2 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" key={warning}>{warning}</p>)}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-neutral-600 text-xs uppercase text-neutral-400"><tr><th className="p-2">Albarán</th><th className="p-2">Descripción</th><th className="p-2 text-right">Cantidad</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Base</th><th className="p-2 text-right">IVA</th><th className="p-2 text-right">Total</th></tr></thead>
              <tbody>{preview.lines.map((line) => <tr className="border-b border-neutral-800" key={`${line.deliveryNoteId}-${line.position}`}><td className="p-2">{line.deliveryNoteNumber}</td><td className="p-2">{line.description}</td><td className="p-2 text-right">{Number(line.quantity)}</td><td className="p-2 text-right">{money(line.unitPrice)}</td><td className="p-2 text-right">{money(line.subtotal)}</td><td className="p-2 text-right">{Number(line.taxRate)} %</td><td className="p-2 text-right font-semibold">{money(line.total)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ml-auto mt-6 max-w-sm space-y-2 border-t border-neutral-600 pt-4 text-sm">
            <div className="flex justify-between"><span>Base imponible</span><span>{money(preview.subtotal)}</span></div>
            <div className="flex justify-between"><span>IVA ({Number(preview.taxRate)} %)</span><span>{money(preview.taxAmount)}</span></div>
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(preview.total)}</span></div>
          </div>
          <p className="mt-8 text-center text-xs text-neutral-400">Has llegado al final de la factura.</p>
          <p className="mt-3 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Al emitir, los albaranes quedarán facturados y bloqueados.</p>
        </div>
        <footer className="border-t border-neutral-700 p-4 sm:p-6">
          <label className={`flex items-start gap-3 text-sm ${reachedEnd ? "text-white" : "text-neutral-500"}`}>
            <input checked={reviewed} disabled={!reachedEnd || isSubmitting} onChange={(event) => setReviewed(event.target.checked)} type="checkbox" />
            He revisado cliente, albaranes, líneas e importes y confirmo que son correctos.
          </label>
          {error ? <p className="mt-3 text-sm text-red-300" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="min-h-11 border border-neutral-600 px-5" disabled={isSubmitting} onClick={onClose} type="button">Cancelar</button>
            <button className="min-h-11 bg-[var(--epx-accent)] px-5 font-semibold text-[#131313] disabled:opacity-40" disabled={!reviewed || isSubmitting} onClick={onConfirm} type="button">{isSubmitting ? "Emitiendo…" : "Emitir factura en Odoo"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
};
