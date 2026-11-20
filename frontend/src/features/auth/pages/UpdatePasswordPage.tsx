import {useState, type FormEvent} from "react";
import {Navigate, useNavigate} from "react-router";
import FormCard from "../components/form/FormCard";
import TextField from "../components/form/TextField";
import SubmitButton from "../components/form/SubmitButton";
import {checkNewPassword} from "../lib/passwordRules";
import {useAuthStore} from "../../../store";
import {toast} from "../../../components/popup";
import {STAFF_ROLES} from "../../../types";

type Errors = {password?: string; confirm?: string};

// forced update of the temporary password created by the staff.
export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  if (user && !user.first_login)
    return <Navigate to="/profile/change-password" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = checkNewPassword(password, confirm);
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await changePassword(password);
      toast.success("Your password has been updated.");
      navigate(user && STAFF_ROLES.includes(user.role) ? "/admin" : "/", {
        replace: true,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", {replace: true});
    }
  };

  return (
    <div className="py-6">
      <FormCard
        title="Update Your Password"
        subtitle="For security reasons, please change your temporary password."
        onSubmit={handleSubmit}
        footer={
          <>
            Do you want to cancel?{" "}
            <button
              type="button"
              onClick={handleCancel}
              className="cursor-pointer underline"
            >
              Return to Login
            </button>
          </>
        }
      >
        <TextField
          label="New Password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <TextField
          label="Confirm New Password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <SubmitButton loading={loading}>Update Password</SubmitButton>
      </FormCard>
    </div>
  );
}
