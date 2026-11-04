import {Navigate, Outlet, useLocation} from "react-router";
import {useAuthStore} from "../../store";
import type {Role} from "../../types";

type RequireRoleProps = {
  roles: Role[];
};

export default function RequireRole({roles}: RequireRoleProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  // wait for the session check, otherwise a page refresh would always bounce to /login
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[#23404d]">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{from: location.pathname}} />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
