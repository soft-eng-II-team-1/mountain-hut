import {Navigate} from "react-router";
import {useAuthStore} from "../../../store";
import {STAFF_ROLES} from "../../../types";

// /profile has no page of its own: hikers land on their bookings, staff on their dashboard
export default function ProfileIndexRedirect() {
  const user = useAuthStore((s) => s.user);
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  return <Navigate to={isStaff ? "/admin" : "bookings"} replace />;
}
