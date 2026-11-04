import {useState} from "react";
import {Link, NavLink, Outlet, useNavigate} from "react-router";
import logo from "../../../assets/logo.svg";
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

  const closeOnMobile = () => {
    if (!window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(false);
  };

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
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col bg-[#536b75] text-white transition-transform md:static md:transition-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <Link
          to="/"
          className="flex flex-col items-center gap-1 px-4 pt-5 pb-6 text-center"
        >
          <img src={logo} alt="Logo" className="h-14 w-14" />
          <p className="text-sm font-semibold tracking-wide">FOND DES FOURS</p>
          <p className="text-[10px] font-medium tracking-wide">MOUNTAIN HUT</p>
        </Link>

        <p className="px-4 pb-2 text-sm text-white/60">Dashboard</p>
        <nav className="flex flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeOnMobile}
              className={({isActive}) =>
                `px-4 py-3 text-sm font-semibold transition ${
                  isActive ? "bg-white/15" : "hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

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
            <span className="font-medium">Logged in as {roleLabel}</span>
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
