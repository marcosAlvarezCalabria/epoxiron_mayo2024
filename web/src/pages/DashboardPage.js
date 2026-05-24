import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/application/use-cases";
export const DashboardPage = () => {
    const { data } = useQuery({
        queryKey: ["dashboard-summary"],
        queryFn: getDashboardSummary
    });
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-100", children: "Dashboard" }), _jsx("p", { className: "text-sm text-gray-400", children: "Resumen operativo del d\u00EDa." })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-4", children: [_jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-800 p-5", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-gray-400", children: "Albaranes hoy" }), _jsx("p", { className: "mt-3 text-3xl font-bold text-gray-100", children: data?.stats.totalNotes ?? 0 })] }), _jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-800 p-5", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-gray-400", children: "Piezas" }), _jsx("p", { className: "mt-3 text-3xl font-bold text-gray-100", children: data?.stats.totalPieces ?? 0 })] }), _jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-800 p-5", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-gray-400", children: "Importe total" }), _jsxs("p", { className: "mt-3 font-mono text-3xl font-bold text-blue-400", children: [data?.stats.totalAmount?.toFixed(2) ?? "0.00", "\u20AC"] })] }), _jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-800 p-5", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-gray-400", children: "Revisados" }), _jsx("p", { className: "mt-3 text-3xl font-bold text-green-400", children: data?.stats.reviewed ?? 0 })] })] })] }));
};
