import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { getCustomers } from "@/application/use-cases";
export const CustomersPage = () => {
    const { data } = useQuery({
        queryKey: ["customers"],
        queryFn: getCustomers
    });
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-100", children: "Clientes" }), _jsx("p", { className: "text-sm text-gray-400", children: "Listado base conectado a la API." })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: data?.customers.map((customer) => (_jsxs("article", { className: "rounded-xl border border-gray-700 bg-gray-800 p-5", children: [_jsx("p", { className: "text-lg font-bold text-gray-100", children: customer.name }), _jsx("p", { className: "mt-2 text-sm text-gray-400", children: customer.email ?? "Sin email" }), _jsxs("div", { className: "mt-4 flex gap-3 text-sm", children: [_jsxs("span", { className: "rounded-full border border-blue-700/50 bg-blue-900/30 px-3 py-1 text-blue-200", children: ["ML ", customer.pricePerLinearMeter.toFixed(2), "\u20AC"] }), _jsxs("span", { className: "rounded-full border border-purple-700/50 bg-purple-900/20 px-3 py-1 text-purple-200", children: ["M\u00B2 ", customer.pricePerSquareMeter.toFixed(2), "\u20AC"] })] })] }, customer.id))) })] }));
};
