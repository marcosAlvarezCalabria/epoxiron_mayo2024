import {
  ArrowPathRoundedSquareIcon,
  CheckBadgeIcon,
  ClockIcon,
  CurrencyEuroIcon
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getDashboardSummary } from "@/application/use-cases";

const statCards = [
  {
    key: "totalNotes",
    label: "Albaranes hoy",
    accent: "text-cyan-300",
    icon: ArrowPathRoundedSquareIcon
  },
  {
    key: "pending",
    label: "Pendientes",
    accent: "text-amber-300",
    icon: ClockIcon
  },
  {
    key: "reviewed",
    label: "Revisados",
    accent: "text-emerald-300",
    icon: CheckBadgeIcon
  },
  {
    key: "totalAmount",
    label: "Importe del dia",
    accent: "text-fuchsia-300",
    icon: CurrencyEuroIcon
  }
] as const;

const statusLabel = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  REVIEWED: "Revisado"
} as const;

export const DashboardPage = () => {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary
  });

  const stats = data?.stats;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">Hoy</p>
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Resumen del taller
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Indicadores diarios para controlar carga, revision y facturacion del
            trabajo en curso.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Link
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center text-sm font-semibold text-cyan-50"
            to="/delivery-notes"
          >
            Nuevo albaran
          </Link>
          <Link
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white"
            to="/customers"
          >
            Ver clientes
          </Link>
        </div>
      </div>

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
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
              key={card.key}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Cola de hoy</h3>
              <p className="text-sm text-slate-400">
                Albaranes activos registrados en la jornada actual.
              </p>
            </div>
            <Link
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
              to="/delivery-notes"
            >
              Abrir cola
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {data?.notes.length ? (
              data.notes.map((note) => (
                <article
                  className="rounded-xl border border-white/10 bg-slate-950/60 p-4"
                  key={note.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {note.number}
                      </p>
                      <p className="text-sm text-slate-400">{note.customerName}</p>
                    </div>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                      {statusLabel[note.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      {note.items.length} lineas
                    </span>
                    <span className="font-mono text-cyan-300">
                      {note.totalAmount.toFixed(2)} {"\u20AC"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-500">
                No hay albaranes cargados para hoy.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Estado de la jornada</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                Revisado
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-100">
                {stats?.reviewed ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                Pendiente
              </p>
              <p className="mt-2 text-2xl font-bold text-amber-100">
                {stats?.pending ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Piezas pintadas hoy
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {stats?.totalPieces ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Suma de cantidades de todas las lineas de hoy.
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

