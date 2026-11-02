import {useState, type ChangeEvent, type FormEvent} from "react";
import {Link, useNavigate} from "react-router";
import FormCard from "../components/form/FormCard";
import TextField from "../components/form/TextField";
import SubmitButton from "../components/form/SubmitButton";
import InfoNote from "../components/form/InfoNote";
import {useAuthStore} from "../../../store";
import {toast} from "../../../components/popup";

type Fields = {
  name: string;
  surname: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

const emptyForm: Fields = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

// Mirrors the backend signup validation rules
function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Name is required";
  else if (f.name.trim().length > 50) e.name = "Name is too long";
  if (!f.surname.trim()) e.surname = "Surname is required";
  else if (f.surname.trim().length > 50) e.surname = "Surname is too long";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim()))
    e.email = "A valid email is required";
  if (f.phone.trim() && !/^\+?[0-9 ]{6,20}$/.test(f.phone.trim()))
    e.phone = "Phone number is not valid";
  if (f.password.length < 8 || f.password.length > 128)
    e.password = "Password must be 8-128 characters long";
  if (f.confirmPassword !== f.password)
    e.confirmPassword = "Passwords do not match";
  return e;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const signup = useAuthStore((s) => s.signup);
  const [form, setForm] = useState<Fields>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({...form, [e.target.name]: e.target.value});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await signup({
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      toast.success("Your account has been created.", {title: "Welcome!"});
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
        title="Create an Account"
        subtitle="Sign up to book your stay at the mountain hut"
        onSubmit={handleSubmit}
        footer={
          <>
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Login
            </Link>
          </>
        }
      >
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-6">
          <TextField
            label="Name"
            name="name"
            autoComplete="given-name"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
          />
          <TextField
            label="Surname"
            name="surname"
            autoComplete="family-name"
            value={form.surname}
            onChange={handleChange}
            error={errors.surname}
          />
        </div>
        <TextField
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <TextField
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={handleChange}
          error={errors.phone}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <TextField
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
        <SubmitButton loading={loading}>Sign up</SubmitButton>
      </FormCard>

      <InfoNote>Hut staff: Your account is managed by the Warden.</InfoNote>
    </div>
  );
}
