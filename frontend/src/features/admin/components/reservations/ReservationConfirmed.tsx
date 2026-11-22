import {formatDate, formatTime} from "../../../../lib/slotTime";
import {bookingRef} from "../../../profile/lib/bookings";
import {seatingOf} from "../../../booking/lib/seating";
import type {BookedReservation} from "./NewBooking";
import Card from "./Card";
import {primaryButton} from "./ui";

type ReservationConfirmedProps = {
  booked: BookedReservation;
  onBack: () => void;
};

export default function ReservationConfirmed({
  booked: {reservation, slot, requirements},
  onBack,
}: ReservationConfirmedProps) {
  return (
    <Card
      title={`Reservation Confirmed – #${bookingRef(reservation.reservation_id)}`}
      actions={
        <button type="button" onClick={onBack} className={primaryButton}>
          Back to Reservations
        </button>
      }
    >
      <div className="rounded-lg border border-gray-300 bg-gray-100 p-6 text-sm">
        <dl className="grid gap-4 text-center sm:grid-cols-3">
          <div>
            <dt className="font-medium">Date</dt>
            <dd>{formatDate(slot.date_time_start)}</dd>
          </div>
          <div>
            <dt className="font-medium">Time Slot</dt>
            <dd>
              {formatTime(slot.date_time_start)} - {formatTime(slot.date_time_end)}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Seating</dt>
            <dd>{seatingOf(reservation.tables)}</dd>
          </div>
        </dl>

        <h3 className="mt-6 font-medium">Dietary restrictions and Allergies:</h3>
        {requirements.length === 0 ? (
          <p className="mt-2">None</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  role="img"
                  aria-label={r.allergies ? "Allergy" : "Requirement"}
                  className={r.allergies ? "text-red-700" : "text-[#24414f]"}
                >
                  {r.allergies ? "▲" : "ⓘ"}
                </span>
                {r.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
