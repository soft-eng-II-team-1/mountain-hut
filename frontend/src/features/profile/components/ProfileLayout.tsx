import {useState} from "react";
import {Outlet, useNavigate} from "react-router";
import Sidebar, {type SidebarItem} from "../../../components/layout/Sidebar";
import Footer from "../../../components/layout/Footer";
import {useAuthStore} from "../../../store";
import {toast} from "../../../components/popup";
import {STAFF_ROLES} from "../../../types";
import LayoutIcon from "../../../assets/icons/admin/dashboard.svg";

export default function ProfileLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );

  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const items: SidebarItem[] = [
    // hikers see their bookings here, staff go back to their dashboard
    isStaff
      ? {to: "/admin", label: "Hut Dashboard"}
      : {to: "/profile/bookings", label: "My Bookings"},
    {to: "/profile/change-password", label: "Change Password"},
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast.info("You have been logged out.");
      navigate("/login");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-[#f3f5f7] text-[#23404d]">
      <div className="flex flex-1">
        <Sidebar
          items={items}
          sectionLabel="Dashboard"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 bg-white px-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label={sidebarOpen ? "Hide menu" : "Show menu"}
                className="cursor-pointer rounded-md p-1.5 transition hover:bg-gray-100"
              >
                <img src={LayoutIcon} alt="Menu" className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold">My Profile</h1>
            </div>
            <div className="flex min-w-0 items-center gap-4 text-sm">
              <span className="hidden truncate font-medium sm:inline">
                {user?.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-md border border-[#24414f] px-3 py-1 text-xs font-medium transition hover:bg-[#24414f] hover:text-white"
              >
                Logout
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-10 md:px-12">
            <Outlet />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
