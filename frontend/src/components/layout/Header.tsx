import {Link, useLocation, useNavigate} from "react-router";
import Logo from "./Logo";
import {useAuthStore} from "../../store";
import {toast} from "../popup";

// Section anchors on the home page. "Book" has no page yet, so it points at
// the services/prices table for now.
const navLinks = [
  {hash: "about", label: "About"},
  {hash: "structure", label: "The structure"},
  {hash: "team", label: "Our team"},
  {hash: "services", label: "Services"},
  {hash: "services", label: "Book"},
];

export default function Header() {
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);

  const action =
    pathname !== "/login"
      ? {to: "/login", label: "Login"}
      : {to: "/signup", label: "Sign up"};

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
    <header className="bg-[#536b75]">
      <div className="mx-auto flex py-4 max-w-6xl items-center justify-between px-6">
        <Logo />
        <div className="flex items-center gap-8">
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                to={{pathname: "/", hash: l.hash}}
                className="text-sm font-medium text-white transition hover:text-white/70"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {/* render nothing until we know whether someone is logged in */}
          {!loading &&
            (user ? (
              <div className="flex items-center gap-4">
                <span className="hidden text-sm text-white sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border cursor-pointer border-white px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to={action.to}
                className="rounded-md border border-white px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                {action.label}
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
