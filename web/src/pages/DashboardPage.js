import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowPathRoundedSquareIcon, CheckBadgeIcon, ClockIcon, CurrencyEuroIcon } from "@heroicons/react/24/outline";
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
];
const statusLabel = {
    DRAFT: "Borrador",
    PENDING: "Pendiente",
    REVIEWED: "Revisado"
};
export const DashboardPage = () => {
    const { data } = useQuery({
        queryKey: ["dashboard-summary"],
        queryFn: getDashboardSummary
    });
    const stats = data?.stats;
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-400", children: "Hoy" }), _jsx("h2", { className: "text-3xl font-semibold tracking-tight text-white", children: "Resumen del taller" }), _jsx("p", { className: "mt-2 max-w-2xl text-sm text-slate-400", children: "Indicadores diarios para controlar carga, revision y facturacion del trabajo en curso." })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:flex", children: [_jsx(Link, { className: "rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center text-sm font-semibold text-cyan-50", to: "/delivery-notes", children: "Nuevo albaran" }), _jsx(Link, { className: "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white", to: "/customers", children: "Ver clientes" })] })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: statCards.map((card) => {
                    const Icon = card.icon;
                    const rawValue = stats?.[card.key] ?? 0;
                    const displayValue = card.key === "totalAmount"
                        ? `${Number(rawValue).toFixed(2)} \u20AC`
                        : rawValue;
                    return (_jsxs("article", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.24em] text-slate-500", children: card.label }), _jsx(Icon, { className: `h-5 w-5 ${card.accent}` })] }), _jsx("p", { className: `mt-5 text-3xl font-bold ${card.accent}`, children: displayValue })] }, card.key));
                }) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[1.1fr_0.9fr]", children: [_jsxs("section", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "Cola de hoy" }), _jsx("p", { className: "text-sm text-slate-400", children: "Albaranes activos registrados en la jornada actual." })] }), _jsx(Link, { className: "rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200", to: "/delivery-notes", children: "Abrir cola" })] }), _jsx("div", { className: "mt-5 space-y-3", children: data?.notes.length ? (data.notes.map((note) => (_jsxs("article", { className: "rounded-xl border border-white/10 bg-slate-950/60 p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-white", children: note.number }), _jsx("p", { className: "text-sm text-slate-400", children: note.customerName })] }), _jsx("span", { className: "rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200", children: statusLabel[note.status] })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-slate-500", children: [note.items.length, " lineas"] }), _jsxs("span", { className: "font-mono text-cyan-300", children: [note.totalAmount.toFixed(2), " ", "\u20AC"] })] })] }, note.id)))) : (_jsx("div", { className: "rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-500", children: "No hay albaranes cargados para hoy." })) })] }), _jsxs("section", { className: "rounded-2xl border border-white/10 bg-slate-900/70 p-5", children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "Estado de la jornada" }), _jsxs("div", { className: "mt-5 space-y-4", children: [_jsxs("div", { className: "rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200", children: "Revisado" }), _jsx("p", { className: "mt-2 text-2xl font-bold text-emerald-100", children: stats?.reviewed ?? 0 })] }), _jsxs("div", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.22em] text-amber-200", children: "Pendiente" }), _jsx("p", { className: "mt-2 text-2xl font-bold text-amber-100", children: stats?.pending ?? 0 })] }), _jsxs("div", { className: "rounded-xl border border-white/10 bg-slate-950/60 p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.22em] text-slate-500", children: "Piezas pintadas hoy" }), _jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: stats?.totalPieces ?? 0 }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "Suma de cantidades de todas las lineas de hoy." })] })] })] })] })] }));
};
