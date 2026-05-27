import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { ArchiveBoxIcon, BuildingOffice2Icon, HomeIcon } from "@heroicons/react/24/outline";
import { NavLink, Outlet } from "react-router-dom";
const navItems = [
    { to: "/", label: "Hoy", icon: HomeIcon },
    { to: "/delivery-notes", label: "Albaranes", icon: ArchiveBoxIcon },
    { to: "/customers", label: "Clientes", icon: BuildingOffice2Icon }
];
export const Layout = () => {
    return (_jsxs("div", { className: "min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100", children: [_jsx("header", { className: "sticky top-0 z-30 border-b border-white/10 bg-slate-950/92 backdrop-blur", children: _jsxs("div", { className: "mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500", children: "Epoxiron" }), _jsx("h1", { className: "mt-1 text-xl font-semibold text-white sm:text-2xl", children: "Gestion del taller" })] }), _jsx("nav", { className: "hidden items-center gap-2 md:flex", children: navItems.map((item) => (_jsx(NavLink, { to: item.to, className: ({ isActive }) => clsx("rounded-xl px-4 py-2 text-sm font-medium transition-colors", isActive
                                    ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                                    : "text-slate-300 hover:bg-white/5 hover:text-white"), children: item.label }, item.to))) })] }) }), _jsx("main", { className: "mx-auto max-w-7xl overflow-x-hidden px-4 pb-24 pt-6 sm:px-6 md:pb-8", children: _jsx(Outlet, {}) }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/96 px-3 py-2 backdrop-blur md:hidden", children: _jsx("div", { className: "mx-auto grid max-w-xl grid-cols-3 gap-2", children: navItems.map((item) => {
                        const Icon = item.icon;
                        return (_jsxs(NavLink, { to: item.to, className: ({ isActive }) => clsx("flex flex-col items-center justify-center rounded-xl px-2 py-3 text-[11px] font-medium transition-colors", isActive
                                ? "bg-cyan-400/10 text-cyan-100"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"), children: [_jsx(Icon, { className: "mb-1 h-5 w-5" }), item.label] }, item.to));
                    }) }) })] }));
};
