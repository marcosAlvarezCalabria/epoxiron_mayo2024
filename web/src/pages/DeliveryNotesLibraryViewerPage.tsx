import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon
} from "@heroicons/react/24/outline";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const getViewerTitle = (fileName: string | null) => fileName?.trim() || "PDF de albaranes";
const isIosSafari = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isTouchMac =
    /Macintosh/i.test(userAgent) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  const isIosDevice = /iP(hone|ad|od)/.test(userAgent) || isTouchMac;
  const isWebkit = /WebKit/i.test(userAgent);
  const isCriOS = /CriOS/i.test(userAgent);
  const isFxiOS = /FxiOS/i.test(userAgent);

  return isIosDevice && isWebkit && !isCriOS && !isFxiOS;
};

export const DeliveryNotesLibraryViewerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pdfUrl = searchParams.get("url");
  const fileName = searchParams.get("fileName");
  const title = useMemo(() => getViewerTitle(fileName), [fileName]);
  const useEmbeddedViewer = useMemo(() => !isIosSafari(), []);

  if (!pdfUrl) {
    navigate("/delivery-notes-library", { replace: true });
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--epx-text-muted)]">Biblioteca</p>
          <div className="mt-2 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-[var(--epx-accent)]" />
            <h2 className="truncate text-xl font-semibold text-white">{title}</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigate("/delivery-notes-library")}
            type="button"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Volver
          </button>
          <a
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--epx-surface-raised)] bg-[var(--epx-bg)] px-4 py-2 text-sm font-semibold text-white"
            href={pdfUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            Abrir fuera
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--epx-accent)]/40 bg-[color:rgb(255_149_0_/_0.16)] px-4 py-2 text-sm font-semibold text-white"
            download={fileName ?? undefined}
            href={pdfUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Descargar
          </a>
        </div>
      </div>

      {useEmbeddedViewer ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--epx-surface-raised)] bg-white">
          <iframe
            className="h-[78vh] w-full"
            src={pdfUrl}
            title={title}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--epx-surface-raised)] bg-[var(--epx-surface)] p-5">
          <p className="text-sm font-semibold text-white">
            En iPhone Safari abrimos el PDF fuera del visor embebido para no bloquear la navegacion.
          </p>
          <p className="mt-2 text-sm text-[var(--epx-text-muted)]">
            Usa "Abrir fuera" para ver el documento y vuelve a esta pantalla con el boton de atras del navegador o cerrando la pestaña abierta.
          </p>
        </div>
      )}
    </section>
  );
};
