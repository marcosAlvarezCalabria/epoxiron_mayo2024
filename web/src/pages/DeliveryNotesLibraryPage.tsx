import { ArrowDownTrayIcon, DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDailyDeliveryNotesReportUploads } from "@/application/use-cases";
import { ApiErrorState } from "@/components/ApiErrorState";
import type { DailyDeliveryNotesReportUpload } from "@/domain/entities";
import { ApiError } from "@/infrastructure/api/apiClient";

const PAGE_SIZE = 60;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

const buildMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

const buildToday = () => new Date().toISOString().slice(0, 10);

export const DeliveryNotesLibraryPage = () => {
  const [dateFrom, setDateFrom] = useState(buildMonthStart);
  const [dateTo, setDateTo] = useState(buildToday);
  const [copiedUploadId, setCopiedUploadId] = useState<string | null>(null);

  const uploadsQuery = useQuery({
    queryKey: ["delivery-note-report-uploads", dateFrom, dateTo],
    queryFn: () =>
      getDailyDeliveryNotesReportUploads({
        dateFrom,
        dateTo,
        limit: PAGE_SIZE
      })
  });

  const queryError =
    uploadsQuery.error instanceof ApiError ? uploadsQuery.error.message : null;
  const uploads = uploadsQuery.data?.uploads ?? [];
  const totals = useMemo(
    () => ({
      reports: uploads.length,
      notes: uploads.reduce((sum, upload) => sum + upload.notesCount, 0)
    }),
    [uploads]
  );

  const handleCopyLink = async (upload: DailyDeliveryNotesReportUpload) => {
    if (!upload.webViewLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(upload.webViewLink);
      setCopiedUploadId(upload.id);
      window.setTimeout(() => {
        setCopiedUploadId((current) => (current === upload.id ? null : current));
      }, 2000);
    } catch {
      setCopiedUploadId(null);
    }
  };

  const buildViewerHref = (upload: DailyDeliveryNotesReportUpload) => {
    const params = new URLSearchParams();
    params.set("url", upload.webViewLink ?? upload.fileId);
    params.set("fileName", upload.fileName);
    return `/delivery-notes-library/view?${params.toString()}`;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--epx-text-muted)]">Biblioteca</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Storage de albaranes
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--epx-text-muted)]">
            Historial de PDFs diarios ya generados en Cloudflare R2 para consultar,
            abrir y descargar los albaranes almacenados.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--epx-text-muted)]">
              Desde
            </span>
            <input
              className="mt-3 w-full rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-sm text-white outline-none"
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--epx-text-muted)]">
              Hasta
            </span>
            <input
              className="mt-3 w-full rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-3 py-2 text-sm text-white outline-none"
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
            PDFs visibles
          </p>
          <p className="mt-4 text-3xl font-bold text-white">{totals.reports}</p>
        </article>
        <article className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
            Albaranes incluidos
          </p>
          <p className="mt-4 text-3xl font-bold text-[var(--epx-accent)]">{totals.notes}</p>
        </article>
        <article className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--epx-text-muted)]">
            Rango consultado
          </p>
          <p className="mt-4 text-sm font-semibold text-white">
            {formatDate(dateFrom)} - {formatDate(dateTo)}
          </p>
        </article>
      </div>

      {queryError ? <ApiErrorState message={queryError} title="Error al cargar la biblioteca" /> : null}

      <section className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Histórico de PDFs</h3>
            <p className="text-sm text-[var(--epx-text-muted)]">
              Se muestran los últimos {PAGE_SIZE} documentos del rango seleccionado.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {uploadsQuery.isLoading ? (
            <div className="rounded-xl border border-dashed border-[var(--epx-surface-raised)] p-6 text-sm text-[var(--epx-text-muted)]">
              Cargando biblioteca...
            </div>
          ) : null}

          {!uploadsQuery.isLoading && uploads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--epx-surface-raised)] p-6 text-sm text-[var(--epx-text-muted)]">
              No hay PDFs históricos en ese rango.
            </div>
          ) : null}

          {uploads.map((upload) => (
            <article
              className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] p-4"
              key={upload.id}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <DocumentTextIcon className="h-4 w-4 text-[var(--epx-accent)]" />
                      {upload.fileName}
                    </span>
                    <span className="rounded-lg border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-3 py-1 text-xs font-semibold text-[var(--epx-text-muted)]">
                      {formatDate(upload.reportDate)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-[var(--epx-text-muted)] sm:grid-cols-3">
                    <p>
                      Carpeta: <span className="font-medium text-white">{upload.folderName}</span>
                    </p>
                    <p>
                      Albaranes: <span className="font-medium text-white">{upload.notesCount}</span>
                    </p>
                    <p>
                      Actualizado:{" "}
                      <span className="font-medium text-white">
                        {formatDate(upload.lastSourceUpdatedAt)}
                      </span>
                    </p>
                  </div>

                  <p className="mt-3 truncate text-xs text-[var(--epx-text-muted)]">
                    {upload.webViewLink ?? upload.fileId}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-2 text-sm font-semibold text-white"
                    to={buildViewerHref(upload)}
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    Ver
                  </Link>
                  <a
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-2 text-sm font-semibold text-white"
                    download
                    href={upload.webViewLink ?? "#"}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Descargar
                  </a>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] px-4 py-2 text-sm font-semibold text-white"
                    disabled={!upload.webViewLink}
                    onClick={() => void handleCopyLink(upload)}
                    type="button"
                  >
                    <LinkIcon className="h-4 w-4" />
                    {copiedUploadId === upload.id ? "Copiado" : "Copiar enlace"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
};
