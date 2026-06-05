import {
  ArrowPathRoundedSquareIcon,
  CheckBadgeIcon,
  ClockIcon,
  CurrencyEuroIcon,
  FolderArrowDownIcon
} from "@heroicons/react/24/outline";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  getDashboardSummary,
  sendDailyDeliveryNotesReport
} from "@/application/use-cases";
import { ApiErrorState } from "@/components/ApiErrorState";
import { ApiError } from "@/infrastructure/api/apiClient";

const statCards = [
  {
    key: "totalNotes",
    label: "Albaranes hoy",
    accent: "text-[var(--epx-accent)]",
    icon: ArrowPathRoundedSquareIcon
  },
  {
    key: "pending",
    label: "Pend. revision",
    accent: "text-[var(--epx-accent)]",
    icon: ClockIcon
  },
  {
    key: "reviewed",
    label: "Revisados",
    accent: "text-[var(--epx-success)]",
    icon: CheckBadgeIcon
  },
  {
    key: "totalAmount",
    label: "Importe del dia",
    accent: "text-[var(--epx-accent)]",
    icon: CurrencyEuroIcon
  }
] as const;

const statusLabel = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  REVIEWED: "Revisado"
} as const;

export const DashboardPage = () => {
  const { data, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary
  });
  const reportMutation = useMutation({
    mutationFn: () => sendDailyDeliveryNotesReport()
  });

  const stats = data?.stats;
  const queryError = error instanceof ApiError ? error.message : null;
  const reportError =
    reportMutation.error instanceof ApiError ? reportMutation.error.message : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--epx-text-muted)]">Hoy</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Resumen del taller
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--epx-text-muted)]">
            Indicadores diarios para controlar carga, revision y facturacion del
            trabajo en curso.
          </p>
        </div>
        <div className="grid gap-3 sm:flex">
          <Link
            className="rounded-xl border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-3 text-center text-sm font-semibold text-white"
            to="/delivery-notes"
          >
            Nuevo albaran
          </Link>
          <Link
            className="rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-3 text-center text-sm font-semibold text-white"
            to="/customers"
          >
            Ver clientes
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">PDF diario de albaranes</h3>
            <p className="mt-1 text-sm text-[var(--epx-text-muted)]">
              Genera el PDF del dia y subelo a Google Drive.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={reportMutation.isPending}
              onClick={() => reportMutation.mutate()}
              type="button"
            >
              <FolderArrowDownIcon className="h-4 w-4" />
              {reportMutation.isPending ? "Subiendo..." : "Subir PDF del dia"}
            </button>
          </div>
        </div>

        {reportMutation.data ? (
          <p className="mt-3 text-sm text-[var(--epx-success)]">
            PDF subido a Google Drive en la carpeta {reportMutation.data.result.folderName} con{" "}
            {reportMutation.data.result.notesCount} albaranes.
          </p>
        ) : null}
        {reportMutation.data?.result.webViewLink ? (
          <a
            className="mt-2 inline-flex text-sm font-semibold text-[var(--epx-accent)]"
            href={reportMutation.data.result.webViewLink}
            rel="noreferrer"
            target="_blank"
          >
            Abrir archivo en Drive
          </a>
        ) : null}
        {reportError ? <p className="mt-3 text-sm text-red-300">{reportError}</p> : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const rawValue = stats?.[card.key] ?? 0;
          const displayValue =
            card.key === "totalAmount"
              ? `${Number(rawValue).toFixed(2)} \u20AC`
              : rawValue;

          return (
            <article
              className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5"
              key={card.key}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--epx-text-muted)]">
                  {card.label}
                </p>
                <Icon className={`h-5 w-5 ${card.accent}`} />
              </div>
              <p className={`mt-5 text-3xl font-bold ${card.accent}`}>
                {displayValue}
              </p>
            </article>
          );
        })}
      </div>

      {queryError ? <ApiErrorState message={queryError} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Cola de hoy</h3>
              <p className="text-sm text-[var(--epx-text-muted)]">
                Albaranes activos registrados en la jornada actual.
              </p>
            </div>
            <Link
              className="rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-xs font-semibold text-white"
              to="/delivery-notes"
            >
              Abrir cola
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {data?.notes.length ? (
              data.notes.map((note) => (
                <Link
                  className="block rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4 transition-colors hover:border-[var(--epx-accent)]/50 hover:bg-[var(--epx-surface)]"
                  key={note.id}
                  to={`/delivery-notes?noteId=${note.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {note.number}
                      </p>
                      <p className="text-sm text-[var(--epx-text-muted)]">{note.customerName}</p>
                    </div>
                    <span className="rounded-lg border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-3 py-1 text-xs font-semibold text-white">
                      {statusLabel[note.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-[var(--epx-text-muted)]">
                      {note.items.length} lineas
                    </span>
                    <span className="font-mono text-[var(--epx-accent)]">
                      {note.totalAmount.toFixed(2)} {"\u20AC"}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--epx-surface-raised)] p-6 text-sm text-[var(--epx-text-muted)]">
                No hay albaranes cargados para hoy.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
          <h3 className="text-lg font-semibold text-white">Estado de la jornada</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[var(--epx-success)]/30 bg-[color:rgb(209_255_0_/_0.12)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--epx-success)]">
                Revisado
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--epx-success)]">
                {stats?.reviewed ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--epx-accent)]/30 bg-[color:rgb(255_149_0_/_0.12)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--epx-accent)]">
                Pendiente de revisar
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--epx-accent)]">
                {stats?.pending ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--epx-text-muted)]">
                Albaranes terminados que aun no se han marcado como revisados.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
                Piezas pintadas hoy
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {stats?.totalPieces ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--epx-text-muted)]">
                Suma de cantidades de todas las lineas de hoy.
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};
