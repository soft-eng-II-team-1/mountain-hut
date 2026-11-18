import {useState, type ReactNode} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {cancelReservation} from "../../../api/reservations";
import {toast} from "../../../components/popup";
import {formatDate, formatTime, mealOf} from "../../../lib/slotTime";
import type {ReservationDetails} from "../../../types";
import {
  InfoBox,
  PageTitle,
  Panel,
  dangerButton,
  outlineButton,
  primaryButton,
} from "../components/BookingUi";
import {
  CHANGE_LIMIT_HOURS,
  bookingRef,
  canChange,
  isUpcoming,
} from "../lib/bookings";
import {useReservation} from "../lib/useReservation";

export default function ReservationDetailsPage() {
  const {reservationId} = useParams();
  const state = useReservation(reservationId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageTitle title="Reservation Details">
        <p>View, manage or cancel your reservation.</p>
        <p>
          Changes and cancellations are allowed up to{" "}
          <strong>{CHANGE_LIMIT_HOURS} hours</strong> before your arrival.
        </p>
      </PageTitle>

      {state.status === "loading" ? (
        <Panel>
          <p className="py-6 text-center">Loading...</p>
        </Panel>
      ) : state.status === "error" ? (
        <Panel>
          <p className="py-6 text-center">
            We couldn’t load this booking: {state.error}
          </p>
        </Panel>
      ) : (
        <Details reservation={state.reservation} />
      )}

      <BackLink />
    </div>
  );
}

export function BackLink() {
  return (
    <Link to="/profile/bookings" className="mt-6 inline-block text-sm underline">
      ← Back to My Bookings
    </Link>
  );
}

function Details({reservation: r}: {reservation: ReservationDetails}) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const upcoming = isUpcoming(r);
  const changeable = canChange(r);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelReservation(r.reservation_id);
      toast.success("Your reservation has been cancelled.");
      navigate("/profile/bookings", {replace: true});
    } catch (err) {
      toast.error((err as Error).message);
      setCancelling(false);
      setConfirming(false);
    }
  };

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-300 pb-4">
        <h3 className="text-2xl font-semibold">
          Booking #{bookingRef(r.reservation_id)}
        </h3>
        {upcoming && (
          <div className="flex gap-3">
            {changeable ? (
              <Link to="edit" className={primaryButton}>
                Edit
              </Link>
            ) : (
              <button type="button" disabled className={primaryButton}>
                Edit
              </button>
            )}
            <button
              type="button"
              disabled={!changeable}
              onClick={() => setConfirming(true)}
              className={dangerButton}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {upcoming && !changeable && (
        <p className="mt-4 rounded-md bg-[#fff4e5] px-4 py-2 text-sm text-[#7a4a00]">
          This booking starts in less than {CHANGE_LIMIT_HOURS} hours, so it can
          no longer be changed or cancelled online. Please contact the hut.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <InfoBox title="General Details:">
          <dl className="flex flex-col gap-3 text-sm">
            <Row label="Meal">{mealOf(r.slot)}</Row>
            <Row label="Date">{formatDate(r.slot.date_time_start)}</Row>
            <Row label="Time Slot">
              {formatTime(r.slot.date_time_start)} – {formatTime(r.slot.date_time_end)}
            </Row>
            <Row label="Guests">{r.people}</Row>
          </dl>
        </InfoBox>

        <InfoBox title="Dietary Restrictions and Allergies:">
          {r.requirements.length === 0 ? (
            <p className="text-sm">No special requirements added.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {r.requirements.map((req, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span className="break-words">{req.description}</span>
                  {req.allergies && (
                    <span className="shrink-0 rounded-full bg-[#8b0d0d] px-2 py-0.5 text-xs font-semibold text-white">
                      Allergy
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </InfoBox>
      </div>

      {confirming && (
        <ConfirmCancel
          busy={cancelling}
          onConfirm={handleCancel}
          onClose={() => setConfirming(false)}
        />
      )}
    </Panel>
  );
}

function Row({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ConfirmCancel({
  busy,
  onConfirm,
  onClose,
}: {
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="w-full max-w-md rounded-xl bg-white p-6 text-[#23404d] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancel-title" className="text-lg font-semibold">
          Cancel this reservation?
        </h3>
        <p className="mt-2 text-sm">
          Your table will be released and this can’t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className={outlineButton}>
            Keep booking
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={dangerButton}>
            {busy ? "Cancelling..." : "Cancel reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}
