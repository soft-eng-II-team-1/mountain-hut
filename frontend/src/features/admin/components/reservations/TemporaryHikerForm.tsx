import {useState, type FormEvent} from "react";
import Card from "./Card";
import Field from "./Field";
import {PHONE_PATTERN, outlineButton, primaryButton, type BookingHiker} from "./ui";

type Errors = {name?: string; surname?: string; phone?: string};

type TemporaryHikerFormProps = {
  onDone: (hiker: Extract<BookingHiker, {kind: "temporary"}>) => void;
  onCancel: () => void;
};

// MH-07: no account and no login, the name and phone are saved with the booking only
export default function TemporaryHikerForm({
  onDone,
  onCancel,
}: TemporaryHikerFormProps) {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e: Errors = {};
    if (!name.trim()) e.name = "Name is required";
    if (!surname.trim()) e.surname = "Surname is required";
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim()))
      e.phone = "Phone number is not valid";
    setErrors(e);
    if (Object.keys(e).length) return;

    onDone({
      kind: "temporary",
      name: name.trim(),
      surname: surname.trim(),
      phone: phone.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card
        title="New Temporary Hiker Profile"
        actions={
          <button type="button" onClick={onCancel} className={outlineButton}>
            Cancel
          </button>
        }
      >
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <Field
            label="Name*"
            name="temp-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <Field
            label="Surname*"
            name="temp-surname"
            autoComplete="off"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            error={errors.surname}
          />
          <Field
            label="Phone Number (optional)"
            name="temp-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
          <button type="submit" className={`${primaryButton} self-center`}>
            Create and Continue to Booking
          </button>
        </div>
      </Card>
    </form>
  );
}
