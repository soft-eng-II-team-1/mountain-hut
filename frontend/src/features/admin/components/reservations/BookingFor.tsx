import {fullName, outlineButton, type BookingHiker} from "./ui";

type BookingForProps = {
  hiker: BookingHiker;
  // without it the bar is read-only (after the booking is confirmed)
  onChange?: () => void;
};

// "Booking for: Mario Rossi – mario@x.com – +39 ..." above the booking card
export default function BookingFor({hiker, onChange}: BookingForProps) {
  const details =
    hiker.kind === "registered"
      ? [hiker.email, hiker.phone].filter(Boolean)
      : [hiker.phone, "(Temporary Hiker)"].filter(Boolean);
  const done = !onChange;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-6 py-3 text-sm shadow-sm ${
        done ? "bg-[#536b75] text-white" : "border border-gray-200 bg-white"
      }`}
    >
      <p>
        Booking for: <span className="font-semibold">{fullName(hiker)}</span>
        {details.map((d) => ` – ${d}`).join("")}
      </p>
      {onChange && (
        <button type="button" onClick={onChange} className={outlineButton}>
          Change User
        </button>
      )}
    </div>
  );
}
