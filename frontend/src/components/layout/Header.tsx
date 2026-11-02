import {Link, useLocation} from "react-router";
import Logo from "./Logo";

export default function Header() {
  const {pathname} = useLocation();

  const action =
    pathname === "/signup"
      ? {to: "/login", label: "Login"}
      : {to: "/signup", label: "Sign up"};

  return (
    <header className="bg-[#536b75]">
      <div className="mx-auto flex py-4 max-w-6xl items-center justify-between px-6">
        <Logo />
        <Link
          to={action.to}
          className="rounded-md border border-white px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
        >
          {action.label}
        </Link>
      </div>
    </header>
  );
}
