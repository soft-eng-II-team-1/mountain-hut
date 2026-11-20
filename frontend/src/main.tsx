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
import UpdatePasswordPage from "./features/auth/pages/UpdatePasswordPage";
import ChangePasswordPage from "./features/auth/pages/ChangePasswordPage";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage";
import ProfileLayout from "./features/profile/components/ProfileLayout";
import ProfileIndexRedirect from "./features/profile/components/ProfileIndexRedirect";
import MyBookingsPage from "./features/profile/pages/MyBookingsPage";
import ReservationDetailsPage from "./features/profile/pages/ReservationDetailsPage";
import EditBookingPage from "./features/profile/pages/EditBookingPage";
import AdminLayout from "./features/admin/components/AdminLayout";
import TableManagementPage from "./features/tables/pages/TableManagementPage";
import TimeSlotManagementPage from "./features/admin/pages/TimeSlotManagementPage";
import ReservationsPage from "./features/admin/pages/ReservationsPage";
import BookTablePage from "./features/booking/pages/BookTablePage";
import {ALL_ROLES, STAFF_ROLES} from "./types";
import PartyRequirementsPage from "./features/booking/pages/PartyRequirementsPage";

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
          {path: "forgot-password", element: <ForgotPasswordPage />},
          {
            element: <RequireRole roles={ALL_ROLES} />,
            children: [
              {path: "update-password", element: <UpdatePasswordPage />},
            ],
          },
          {
            element: <RequireRole roles={["hiker"]} />,
            children: [
              {path: "book", element: <BookTablePage />},
              // MH-05: party requirements of the reservation just booked
              {
                path: "book/:reservationId/requirements",
                element: <PartyRequirementsPage />,
              },
            ],
          },
        ],
      },
      {
        path: "/profile",
        element: <RequireRole roles={ALL_ROLES} />,
        children: [
          {
            element: <ProfileLayout />,
            children: [
              {index: true, element: <ProfileIndexRedirect />},
              {path: "change-password", element: <ChangePasswordPage />},
              {
                element: <RequireRole roles={["hiker"]} />,
                children: [
                  {path: "bookings", element: <MyBookingsPage />},
                  {
                    path: "bookings/:reservationId",
                    element: <ReservationDetailsPage />,
                  },
                  {
                    path: "bookings/:reservationId/edit",
                    element: <EditBookingPage />,
                  },
                ],
              },
            ],
          },
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
              // MH-07: only employees can book on behalf of a hiker
              {
                element: <RequireRole roles={["employee"]} />,
                children: [
                  {path: "reservations", element: <ReservationsPage />},
                ],
              },
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
