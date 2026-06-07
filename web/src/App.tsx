import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DeliveryNotesPage } from "@/pages/DeliveryNotesPage";
import { LoginPage } from "@/pages/LoginPage";

export const App = () => {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
        path="/"
      >
        <Route element={<DashboardPage />} index />
        <Route element={<CustomersPage />} path="customers" />
        <Route element={<DeliveryNotesPage />} path="delivery-notes" />
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
};
