import {useState, type FormEvent} from "react";
import {Link, useNavigate} from "react-router";
import FormCard from "../components/form/FormCard";
import TextField from "../components/form/TextField";
import SubmitButton from "../components/form/SubmitButton";
import InfoNote from "../components/form/InfoNote";
import {useAuthStore} from "../../../store";
import {toast} from "../../../components/popup";

type Errors = Partial<Record<"email" | "password", string>>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      e.email = "A valid email is required";
    if (!password) e.password = "Password is required";
    return e;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("You are now logged in.", {title: "Welcome back!"});
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-11 py-6">
      <FormCard
        title="Welcome Back"
        subtitle="Login to manage your bookings and mountain stays"
        onSubmit={handleSubmit}
        footer={
          <>
            Don’t have an account?{" "}
            <Link to="/signup" className="underline">
              Sign up
            </Link>
          </>
        }
      >
        <TextField
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <SubmitButton loading={loading}>Login</SubmitButton>
      </FormCard>

      <InfoNote>Hut staff: Your account is managed by the Warden.</InfoNote>
    </div>
  );
}
