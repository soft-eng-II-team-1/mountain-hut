import {useState, type ChangeEvent, type FormEvent} from "react";
import {createHiker} from "../../../../api/hikers";
import {ApiError} from "../../../../api/client";
import {toast} from "../../../../components/popup";
import type {HikerSummary, NewHiker} from "../../../../types";
import Card from "./Card";
import Field from "./Field";
import {PHONE_PATTERN, outlineButton, primaryButton} from "./ui";

type Form = Required<NewHiker>;
type Errors = Partial<Record<keyof Form, string>>;

const empty: Form = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  emergency_contact: "",
  notes: "",
};

// same limits as the backend (userRules.js)
const validate = (f: Form): Errors => {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Name is required";
  else if (f.name.trim().length > 50) e.name = "Name is too long";
  if (!f.surname.trim()) e.surname = "Surname is required";
  else if (f.surname.trim().length > 50) e.surname = "Surname is too long";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim()))
    e.email = "A valid email is required";
  if (f.phone.trim() && !PHONE_PATTERN.test(f.phone.trim()))
    e.phone = "Phone number is not valid";
  if (f.emergency_contact.trim().length > 100)
    e.emergency_contact = "Emergency contact is too long";
  if (f.notes.trim().length > 256) e.notes = "Notes are too long";
  return e;
};

type CompleteHikerFormProps = {
  onCreated: (hiker: HikerSummary, password: string) => void;
  onCancel: () => void;
};

// MH-07: a full account with login access; the backend generates the password
export default function CompleteHikerForm({
  onCreated,
  onCancel,
}: CompleteHikerFormProps) {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const field = (key: keyof Form) => ({
    name: key,
    value: form[key],
    error: errors[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({...f, [key]: e.target.value})),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;

    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    ) as Form;
    setSaving(true);
    try {
      const created = await createHiker({
        name: trimmed.name,
        surname: trimmed.surname,
        email: trimmed.email,
        phone: trimmed.phone || undefined,
        emergency_contact: trimmed.emergency_contact || undefined,
        notes: trimmed.notes || undefined,
      });
      onCreated(
        {
          user_id: created.user_id,
          name: trimmed.name,
          surname: trimmed.surname,
          email: created.email,
          phone: trimmed.phone || null,
        },
        created.generated_password,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setErrors({email: "This email is already registered, search for it instead"});
      else toast.error((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card
        title="New Complete Hiker Profile"
        actions={
          <button type="button" onClick={onCancel} className={outlineButton}>
            Cancel
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name*" autoComplete="off" {...field("name")} />
          <Field label="Phone Number" type="tel" {...field("phone")} />
          <Field label="Surname*" autoComplete="off" {...field("surname")} />
          <Field label="Emergency Contact" {...field("emergency_contact")} />
          <Field label="Email*" type="email" autoComplete="off" {...field("email")} />
          <Field label="Notes" {...field("notes")} />
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "Creating…" : "Create Profile"}
          </button>
        </div>
      </Card>
    </form>
  );
}
