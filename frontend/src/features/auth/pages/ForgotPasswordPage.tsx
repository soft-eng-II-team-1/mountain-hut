import {useState, type FormEvent} from "react";
import {Link, useNavigate} from "react-router";
import FormCard from "../components/form/FormCard";
import TextField from "../components/form/TextField";
import SubmitButton from "../components/form/SubmitButton";
import {checkNewPassword} from "../lib/passwordRules";
import * as authApi from "../../../api/auth";
import {toast} from "../../../components/popup";

type Step = "email" | "code" | "password";
type Errors = Partial<
  Record<"email" | "code" | "password" | "confirm", string>
>;

const backToLogin = (
  <>
    Remembered it?{" "}
    <Link to="/login" className="underline">
      Return to Login
    </Link>
  </>
);

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  // runs the call with the loading flag and a toast on failure
  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendCode = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const e: Errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      e.email = "A valid email is required";
    setErrors(e);
    if (Object.keys(e).length) return;

    run(async () => {
      await authApi.requestPasswordReset(email.trim());
      toast.info("If an account exists for this email, a code has been sent.");
      setStep("code");
    });
  };

  const checkCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e: Errors = {};
    if (!code.trim()) e.code = "Please enter the code you received";
    setErrors(e);
    if (Object.keys(e).length) return;

    run(async () => {
      await authApi.verifyResetCode(email.trim(), code.trim());
      setStep("password");
    });
  };

  const savePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e: Errors = checkNewPassword(password, confirm);
    setErrors(e);
    if (Object.keys(e).length) return;

    run(async () => {
      await authApi.resetPassword(email.trim(), code.trim(), password);
      toast.success("You can now log in with your new password.", {
        title: "Password changed",
      });
      navigate("/login", {replace: true});
    });
  };

  if (step === "email") {
    return (
      <div className="py-6">
        <FormCard
          title="Forgot Password"
          subtitle="Enter your email and we will send you a verification code."
          onSubmit={sendCode}
          footer={backToLogin}
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
          <SubmitButton loading={loading}>Send Code</SubmitButton>
        </FormCard>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="py-6">
        <FormCard
          title="Enter Verification Code"
          subtitle={`We sent a code to ${email.trim()}.`}
          onSubmit={checkCode}
          footer={
            <>
              Didn’t get it?{" "}
              <button
                type="button"
                disabled={loading}
                onClick={() => sendCode()}
                className="cursor-pointer underline disabled:cursor-not-allowed"
              >
                Send a new code
              </button>
              {" · "}
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setErrors({});
                  setStep("email");
                }}
                className="cursor-pointer underline"
              >
                Change email
              </button>
            </>
          }
        >
          <TextField
            label="Verification Code"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />
          <SubmitButton loading={loading}>Verify Code</SubmitButton>
        </FormCard>
      </div>
    );
  }

  return (
    <div className="py-6">
      <FormCard
        title="Reset Password"
        subtitle="Choose a new password for your account."
        onSubmit={savePassword}
        footer={backToLogin}
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
        <SubmitButton loading={loading}>Reset Password</SubmitButton>
      </FormCard>
    </div>
  );
}
