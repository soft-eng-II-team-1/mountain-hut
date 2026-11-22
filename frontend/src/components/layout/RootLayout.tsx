import {useEffect} from "react";
import {Navigate, Outlet, useLocation} from "react-router";
import {useAuthStore} from "../../store";
import {ToastContainer} from "../popup";

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const {pathname} = useLocation();

  // Restore the logged-in user from the session cookie on page load
  useEffect(() => {
    init();
  }, [init]);

  // MH-07: until the temporary password is replaced, every page leads to the update form
  if (user?.first_login && pathname !== "/update-password") {
    return <Navigate to="/update-password" replace />;
  }

  return (
    <>
      <Outlet />
      <ToastContainer />
    </>
  );
}
