import {useEffect, useState} from "react";
import {Link} from "react-router";
import {getMyReservations} from "../../../api/reservations";
import {formatDate, formatTime, mealOf} from "../../../lib/slotTime";
import type {ReservationDetails} from "../../../types";
import {bookingRef, isUpcoming} from "../lib/bookings";
import {
  BookMoreLink,
  PageTitle,
  Panel,
  outlineButton,
  primaryButton,
} from "../components/BookingUi";
import emptyImage from "../../../assets/images/image-10.png";

type Loaded = {reservations: ReservationDetails[]} | {error: string};

const byStart = (a: ReservationDetails, b: ReservationDetails) =>
  a.slot.date_time_start.localeCompare(b.slot.date_time_start);

export default function MyBookingsPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getMyReservations()
      .then((reservations) => active && setLoaded({reservations}))
      .catch((err: Error) => active && setLoaded({error: err.message}));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const all = loaded && "reservations" in loaded ? loaded.reservations : [];
  const upcoming = all.filter(isUpcoming).sort(byStart);
  // most recent first
  const past = all.filter((r) => !isUpcoming(r)).sort((a, b) => byStart(b, a));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageTitle title="My Bookings">
        View and manage your upcoming reservations.
      </PageTitle>

      <Panel>
        <h3 className="mb-4 text-xl font-semibold">Reservations</h3>

        {!loaded ? (
          <p className="py-6 text-center">Loading...</p>
        ) : "error" in loaded ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p>We couldn’t load your bookings: {loaded.error}</p>
            <button
              type="button"
              onClick={() => {
                setLoaded(null);
                setReloadKey((k) => k + 1);
              }}
              className={primaryButton}
            >
              Try again
            </button>
          </div>
        ) : all.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-6">
            <BookingGroup title="Upcoming" items={upcoming} manageable />
            {past.length > 0 && <BookingGroup title="Past" items={past} />}
            <hr className="mx-auto w-4/5 border-gray-300" />
            <BookMoreLink />
          </div>
        )}
      </Panel>
    </div>
  );
}

function BookingGroup({
  title,
  items,
  manageable = false,
}: {
  title: string;
  items: ReservationDetails[];
  manageable?: boolean;
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-[#23404d]/70">No upcoming bookings.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <BookingRow
              key={r.reservation_id}
              reservation={r}
              manageable={manageable}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BookingRow({
  reservation: r,
  manageable,
}: {
  reservation: ReservationDetails;
  manageable: boolean;
}) {
  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border border-gray-400 px-4 py-3 sm:flex-row sm:items-center ${
        manageable ? "" : "opacity-70"
      }`}
    >
      <div className="shrink-0 text-sm sm:w-32 sm:border-r sm:border-gray-400 sm:pr-4">
        <p>{formatDate(r.slot.date_time_start)}</p>
        <p>
          {formatTime(r.slot.date_time_start)} –{" "}
          {formatTime(r.slot.date_time_end)}
        </p>
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Booking #{bookingRef(r.reservation_id)}</p>
        <p>
          Table for {r.people} – {mealOf(r.slot)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-6 sm:justify-end">
        <span
          className={`text-sm font-semibold ${manageable ? "text-[#2e6b3a]" : "text-[#23404d]/70"}`}
        >
          {manageable ? "Confirmed" : "Completed"}
        </span>
        <Link
          to={`/profile/bookings/${r.reservation_id}`}
          className={manageable ? primaryButton : outlineButton}
        >
          {manageable ? "Manage" : "View"}
        </Link>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <img src={emptyImage} alt="Empty state" className="w-2/5 h-full" />
      <p className="font-semibold">
        Looks like you don’t have any bookings yet.
      </p>
      <BookMoreLink />
    </div>
  );
}
