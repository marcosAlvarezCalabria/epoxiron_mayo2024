import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/application/use-cases";

export const DashboardPage = () => {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>
        <p className="text-sm text-gray-400">Resumen operativo del día.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Albaranes hoy</p>
          <p className="mt-3 text-3xl font-bold text-gray-100">{data?.stats.totalNotes ?? 0}</p>
        </article>
        <article className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Piezas</p>
          <p className="mt-3 text-3xl font-bold text-gray-100">{data?.stats.totalPieces ?? 0}</p>
        </article>
        <article className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Importe total</p>
          <p className="mt-3 font-mono text-3xl font-bold text-blue-400">
            {data?.stats.totalAmount?.toFixed(2) ?? "0.00"}€
          </p>
        </article>
        <article className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Revisados</p>
          <p className="mt-3 text-3xl font-bold text-green-400">{data?.stats.reviewed ?? 0}</p>
        </article>
      </div>
    </section>
  );
};

