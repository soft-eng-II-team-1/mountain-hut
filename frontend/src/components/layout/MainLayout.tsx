import {useEffect} from "react";
import {Outlet} from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import {useAuthStore} from "../../store";
import {ToastContainer} from "../popup";

export default function MainLayout() {
  const init = useAuthStore((s) => s.init);

  // Restore the logged-in user from the session cookie on page load
  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ToastContainer />
    </div>
  );
}
