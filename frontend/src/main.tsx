import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {createBrowserRouter, Navigate, RouterProvider} from "react-router";
import "./styles/index.css";
import RootLayout from "./components/layout/RootLayout";
import MainLayout from "./components/layout/MainLayout";
import RequireRole from "./components/routing/RequireRole";
import HomePage from "./features/home/pages/HomePage";
import LoginPage from "./features/auth/pages/LoginPage";
import SignupPage from "./features/auth/pages/SignupPage";
import AdminLayout from "./features/admin/components/AdminLayout";
import TableManagementPage from "./features/admin/pages/TableManagementPage";
import TimeSlotManagementPage from "./features/admin/pages/TimeSlotManagementPage";
import {STAFF_ROLES} from "./types";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          {index: true, element: <HomePage />},
          {path: "login", element: <LoginPage />},
          {path: "signup", element: <SignupPage />},
          {path: "services", element: <p>To be implemented</p>},
        ],
      },
      {
        path: "/admin",
        element: <RequireRole roles={STAFF_ROLES} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {index: true, element: <Navigate to="tables" replace />},
              {path: "tables", element: <TableManagementPage />},
              {path: "slots", element: <TimeSlotManagementPage />},
            ],
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
