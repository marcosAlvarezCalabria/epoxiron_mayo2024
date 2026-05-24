import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DeliveryNotesPage } from "@/pages/DeliveryNotesPage";

export const App = () => {
  return (
    <Routes>
      <Route element={<Layout />} path="/">
        <Route element={<DashboardPage />} index />
        <Route element={<CustomersPage />} path="customers" />
        <Route element={<DeliveryNotesPage />} path="delivery-notes" />
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
};
