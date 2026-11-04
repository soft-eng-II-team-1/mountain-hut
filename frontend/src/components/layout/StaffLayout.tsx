import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router";
import logo from "../../assets/logo.svg";
import { useAuthStore } from "../../store";
import { ToastContainer } from "../popup";

export default function StaffLayout() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    init();
  }, [init]);

  const roleLabel =
    user?.role === "warden"
      ? "Warden"
      : user?.role === "employee"
        ? "Employee"
        : "Staff";

  return (
    <div className="flex min-h-screen bg-[#f0f3f5] text-[#23404d]">
      {/* Left Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-64 shrink-0 flex-col bg-[#4a626d] text-white">
          <Link
            to="/"
            className="flex flex-col items-center px-6 pt-8 pb-10 text-center"
          >
            <img src={logo} alt="Fond des Fours Logo" className="h-16 w-auto" />
            <p className="mt-3 text-base font-bold tracking-wider">
              FOND DES FOURS
            </p>
            <p className="text-xs font-medium tracking-widest text-white/90">
              MOUNTAIN HUT
            </p>
          </Link>

          <nav className="flex flex-col text-sm">
            <div className="px-6 py-3 text-white/75">Dashboard</div>

            <NavLink
              to="/staff/tables"
              className={({ isActive }) =>
                `px-6 py-4 font-semibold transition ${
                  isActive
                    ? "border-l-4 border-white bg-[#566f7a] text-white"
                    : "text-white/90 hover:bg-white/5"
                }`
              }
            >
              Table Management
            </NavLink>

            <NavLink
              to="/staff/slots"
              className={({ isActive }) =>
                `px-6 py-4 font-semibold transition ${
                  isActive
                    ? "border-l-4 border-white bg-[#566f7a] text-white"
                    : "text-white/90 hover:bg-white/5"
                }`
              }
            >
              Time Slot Management
            </NavLink>
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Top White Header */}
        <header className="flex h-20 items-center justify-between bg-white px-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle dashboard menu"
            className="cursor-pointer rounded-lg p-2 text-[#23404d] transition hover:bg-[#23404d]/5"
          >
            {/* 4-circle/petal icon from top-left of screenshot */}
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="3.2" />
              <ellipse
                cx="17"
                cy="7"
                rx="3.8"
                ry="2.2"
                transform="rotate(-40 17 7)"
              />
              <circle cx="7" cy="17" r="3.2" />
              <circle cx="17" cy="17" r="3.2" />
            </svg>
          </button>

          <span className="text-sm font-bold text-[#23404d]">
            Logged in as {roleLabel}
          </span>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-10 py-12">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}