import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { HermesPanel } from "@/features/hermes/components/HermesPanel";
const navItems = [
    { to: "/", label: "Dashboard" },
    { to: "/customers", label: "Clientes" },
    { to: "/delivery-notes", label: "Albaranes" }
];
export const Layout = () => {
    return (_jsxs("div", { className: "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,_#111827_0%,_#0f172a_100%)]", children: [_jsx("header", { className: "border-b border-gray-800 bg-gray-900/80 backdrop-blur", children: _jsxs("div", { className: "mx-auto flex max-w-7xl items-center justify-between px-6 py-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-gray-100", children: "Epoxiron" }), _jsx("p", { className: "text-sm text-gray-400", children: "Taller de pintura industrial" })] }), _jsx("nav", { className: "flex gap-2", children: navItems.map((item) => (_jsx(NavLink, { to: item.to, className: ({ isActive }) => clsx("rounded-lg px-4 py-2 text-sm font-semibold transition-colors", isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"), children: item.label }, item.to))) })] }) }), _jsx("main", { className: "mx-auto max-w-7xl px-6 py-8", children: _jsx(Outlet, {}) }), _jsx(HermesPanel, {})] }));
};
