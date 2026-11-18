import {useState} from "react";
import {Link, Outlet, useNavigate} from "react-router";
import Sidebar from "../../../components/layout/Sidebar";
import {useAuthStore} from "../../../store";
import {toast} from "../../../components/popup";
import LayoutIcon from "../../../assets/icons/admin/dashboard.svg";

const navItems = [
  {to: "/admin/tables", label: "Table Management"},
  {to: "/admin/slots", label: "Time Slot Management"},
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );

  const handleLogout = async () => {
    try {
      await logout();
      toast.info("You have been logged out.");
      navigate("/login");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const roleLabel = user
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "";

  return (
    <div className="flex h-full bg-[#f3f5f7] text-[#23404d]">
      <Sidebar
        items={navItems}
        sectionLabel="Dashboard"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between bg-white px-4 shadow-sm">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Hide menu" : "Show menu"}
            className="cursor-pointer rounded-md p-1.5 text-[#536b75] transition hover:bg-gray-100"
          >
            <img src={LayoutIcon} alt="Menu" className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/profile" className="font-medium hover:underline">
              Logged in as {roleLabel}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer rounded-md border border-[#24414f] px-3 py-1 text-xs font-medium transition hover:bg-[#24414f] hover:text-white"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-10 md:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
