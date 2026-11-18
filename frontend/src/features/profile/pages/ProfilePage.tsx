import {useEffect, useState, type FormEvent, type ReactNode} from "react";
import {Link} from "react-router";
import * as profileApi from "../../../api/profile";
import {toast} from "../../../components/popup";
import type {Profile, Role} from "../../../types";

const ROLE_LABELS: Record<Role, string> = {
  hiker: "Guest / Hiker",
  employee: "Hut Staff",
  warden: "Warden",
};

type Form = {name: string; surname: string; phone: string};
type Errors = Partial<Record<keyof Form, string>>;

const toForm = (p: Profile): Form => ({
  name: p.name,
  surname: p.surname,
  phone: p.phone ?? "",
});

// Same rules the backend applies at sign up
function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "First name is required";
  else if (f.name.trim().length > 50) e.name = "First name is too long";
  if (!f.surname.trim()) e.surname = "Last name is required";
  else if (f.surname.trim().length > 50) e.surname = "Last name is too long";
  if (f.phone.trim() && !/^\+?[0-9 ]{6,20}$/.test(f.phone.trim()))
    e.phone = "Phone number is not valid";
  return e;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>({name: "", surname: "", phone: ""});
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // bumped by "Try again" to fetch once more
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    profileApi
      .getProfile()
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setForm(toForm(p));
      })
      .catch((err: Error) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoadError(null);
    setReloadKey((k) => k + 1);
  };

  const set = (key: keyof Form) => (value: string) =>
    setForm((f) => ({...f, [key]: value}));

  const cancelEdit = () => {
    if (profile) setForm(toForm(profile));
    setErrors({});
    setEditing(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const updated = await profileApi.updateProfile({
        name: form.name.trim(),
        surname: form.surname.trim(),
        phone: form.phone.trim() || undefined,
      });
      setProfile(updated);
      setForm(toForm(updated));
      setEditing(false);
      toast.success("Your details have been updated.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <ProfileHeading profile={profile} />

      <Card>
        {loadError ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p>We couldn’t load your details: {loadError}</p>
            <button
              type="button"
              onClick={retry}
              className="cursor-pointer rounded-lg bg-[#24414f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c3440]"
            >
              Try again
            </button>
          </div>
        ) : !profile ? (
          <p className="py-4 text-center">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Personal Details</h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={primaryButton}
                >
                  Edit Details
                </button>
              )}
            </div>

            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field
                label="First Name"
                name="name"
                autoComplete="given-name"
                value={form.name}
                onChange={set("name")}
                editable={editing}
                error={errors.name}
              />
              <Field
                label="Last Name"
                name="surname"
                autoComplete="family-name"
                value={form.surname}
                onChange={set("surname")}
                editable={editing}
                error={errors.surname}
              />
              <Field
                label="Email Address"
                name="email"
                value={profile.email}
                editable={false}
                hint={editing ? "The email is your login and can’t be changed." : undefined}
              />
              <Field
                label="Phone Number (optional)"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={set("phone")}
                editable={editing}
                error={errors.phone}
                placeholder={editing ? "+39 333 1234567" : "Not provided"}
              />
            </div>

            {editing && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="cursor-pointer rounded-lg border border-[#24414f] px-4 py-2 text-sm font-semibold transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={primaryButton}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Password and Security</h2>
            <p className="text-sm">
              Update your password to keep your account secure.
            </p>
          </div>
          <Link to="/change-password" className={`${primaryButton} self-start sm:self-auto`}>
            Change Password
          </Link>
        </div>
      </Card>
    </div>
  );
}

const primaryButton =
  "cursor-pointer rounded-lg bg-[#24414f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1c3440] disabled:cursor-not-allowed disabled:opacity-60";

function Card({children}: {children: ReactNode}) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-[4px_6px_10px_rgba(0,0,0,0.15)] sm:px-8">
      {children}
    </section>
  );
}

function ProfileHeading({profile}: {profile: Profile | null}) {
  const initials = profile
    ? `${profile.name.charAt(0)}${profile.surname.charAt(0)}`.toUpperCase()
    : "";

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#536b75] text-2xl font-semibold text-white">
          {initials}
        </div>
        {/* small badge with the person icon, as in the design */}
        <span className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#24414f]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
            <circle cx="12" cy="7" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
          </svg>
        </span>
      </div>
      <div className="min-w-0">
        {profile && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-2xl font-semibold">
              {profile.name} {profile.surname}
            </h2>
            <span className="rounded-full bg-[#24414f] px-3 py-0.5 text-xs font-semibold text-white">
              {ROLE_LABELS[profile.role]}
            </span>
          </div>
        )}
        <p className="text-sm">
          Manage your personal information and contact details.
        </p>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  editable: boolean;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
};

// Grey read-only box that turns into a normal input in edit mode
function Field({
  label,
  name,
  value,
  editable,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
  placeholder,
}: FieldProps) {
  return (
    <label htmlFor={name} className="flex flex-col gap-1 text-sm">
      {label}
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        readOnly={!editable}
        onChange={(e) => onChange?.(e.target.value)}
        className={`rounded-md border px-3 py-2 text-base outline-none ${
          editable
            ? "bg-white focus:ring-2 focus:ring-[#24414f]/40"
            : "cursor-default bg-[#ececec] text-[#23404d]/90"
        } ${error ? "border-red-600" : "border-gray-400"}`}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
      {hint && !error && <span className="text-xs text-[#23404d]/70">{hint}</span>}
    </label>
  );
}
