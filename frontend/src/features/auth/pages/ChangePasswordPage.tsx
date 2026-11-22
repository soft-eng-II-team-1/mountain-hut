import {useState, type FormEvent} from "react";
import {useNavigate} from "react-router";
import FormCard from "../components/form/FormCard";
import TextField from "../components/form/TextField";
import SubmitButton from "../components/form/SubmitButton";
import {checkNewPassword} from "../lib/passwordRules";
import {useAuthStore} from "../../../store";
import {toast} from "../../../components/popup";
import {ApiError} from "../../../api/client";
import {INVALID_OLD_PASSWORD} from "../../../api/auth";

type Errors = {current?: string; password?: string; confirm?: string};

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const changePassword = useAuthStore((s) => s.changePassword);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): Errors => {
    const e: Errors = checkNewPassword(password, confirm);
    if (!current) e.current = "Current password is required";
    else if (!e.password && password === current)
      e.password = "The new password must be different from the current one";
    return e;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await changePassword(password, current);
      toast.success("Your password has been changed.");
      navigate("/profile");
    } catch (err) {
      // an expired session is a 401 too, only this code means a wrong old password
      if (err instanceof ApiError && err.code === INVALID_OLD_PASSWORD)
        setErrors({current: "Current password is incorrect"});
      else toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6">
      <FormCard
        title="Change Password"
        subtitle="Choose a new password for your account."
        onSubmit={handleSubmit}
      >
        <TextField
          label="Current Password"
          name="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current}
        />
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
        <SubmitButton loading={loading}>Change Password</SubmitButton>
      </FormCard>
    </div>
  );
}
