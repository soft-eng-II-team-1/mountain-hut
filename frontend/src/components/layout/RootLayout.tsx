import {useEffect} from "react";
import {Outlet} from "react-router";
import {useAuthStore} from "../../store";
import {ToastContainer} from "../popup";

// Shared by the public site and the staff dashboard
export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  // Restore the logged-in user from the session cookie on page load
  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <Outlet />
      <ToastContainer />
    </>
  );
}
