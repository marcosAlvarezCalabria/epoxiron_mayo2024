import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { getDeliveryNotes } from "@/application/use-cases";
const badgeByStatus = {
    DRAFT: "bg-gray-700 text-gray-300",
    PENDING: "border border-yellow-700/50 bg-yellow-900/30 text-yellow-400",
    REVIEWED: "border border-green-700/50 bg-green-900/30 text-green-400"
};
export const DeliveryNotesPage = () => {
    const { data } = useQuery({
        queryKey: ["delivery-notes"],
        queryFn: getDeliveryNotes
    });
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-100", children: "Albaranes" }), _jsx("p", { className: "text-sm text-gray-400", children: "Consulta y seguimiento operativo." })] }), _jsx("div", { className: "space-y-4", children: data?.deliveryNotes.map((note) => (_jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-800 p-5", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-bold text-gray-100", children: note.number }), _jsx("p", { className: "text-sm text-gray-400", children: note.customerName })] }), _jsx("span", { className: `rounded-full px-3 py-1 text-xs font-semibold ${badgeByStatus[note.status]}`, children: note.status })] }), _jsxs("div", { className: "mt-4 flex items-center justify-between text-sm text-gray-400", children: [_jsx("span", { children: new Date(note.date).toLocaleDateString("es-ES") }), _jsxs("span", { className: "font-mono text-blue-400", children: [note.totalAmount.toFixed(2), "\u20AC"] })] })] }, note.id))) })] }));
};
