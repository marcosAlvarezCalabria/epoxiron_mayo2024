import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DeliveryNotesPage } from "@/pages/DeliveryNotesPage";
export const App = () => {
    return (_jsxs(Routes, { children: [_jsxs(Route, { element: _jsx(Layout, {}), path: "/", children: [_jsx(Route, { element: _jsx(DashboardPage, {}), index: true }), _jsx(Route, { element: _jsx(CustomersPage, {}), path: "customers" }), _jsx(Route, { element: _jsx(DeliveryNotesPage, {}), path: "delivery-notes" })] }), _jsx(Route, { element: _jsx(Navigate, { replace: true, to: "/" }), path: "*" })] }));
};
