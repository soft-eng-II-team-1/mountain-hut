import {useState} from "react";
import PageHeader from "../components/PageHeader";
import HikerSearch from "../components/reservations/HikerSearch";
import CompleteHikerForm from "../components/reservations/CompleteHikerForm";
import HikerCreated from "../components/reservations/HikerCreated";
import TemporaryHikerForm from "../components/reservations/TemporaryHikerForm";
import BookingFor from "../components/reservations/BookingFor";
import NewBooking, {
  type BookedReservation,
} from "../components/reservations/NewBooking";
import ReservationConfirmed from "../components/reservations/ReservationConfirmed";
import type {BookingHiker} from "../components/reservations/ui";
import type {HikerSummary} from "../../../types";

type Step =
  | {kind: "search"}
  | {kind: "complete"}
  | {kind: "temporary"}
  | {kind: "created"; hiker: HikerSummary; password: string}
  | {kind: "booking"; hiker: BookingHiker}
  | {kind: "confirmed"; hiker: BookingHiker; booked: BookedReservation};

const subtitles: Partial<Record<Step["kind"], string>> = {
  search: "Search for a hiker to place a reservation.",
  complete: "Create a complete hiker account with login access.",
  temporary: "Create a temporary hiker account (no login access).",
};

// MH-07: an employee books for a hiker (phone call, party at the hut):
// find them, or create a complete or temporary profile, then book
export default function ReservationsPage() {
  const [step, setStep] = useState<Step>({kind: "search"});
  const toSearch = () => setStep({kind: "search"});
  const registered = (h: HikerSummary): BookingHiker => ({kind: "registered", ...h});

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title="Reserve for a Hiker" subtitle={subtitles[step.kind]} />

      {step.kind === "search" && (
        <HikerSearch
          onSelect={(h) => setStep({kind: "booking", hiker: registered(h)})}
          onCreateComplete={() => setStep({kind: "complete"})}
          onCreateTemporary={() => setStep({kind: "temporary"})}
        />
      )}

      {step.kind === "complete" && (
        <CompleteHikerForm
          onCreated={(hiker, password) =>
            setStep({kind: "created", hiker, password})
          }
          onCancel={toSearch}
        />
      )}

      {step.kind === "created" && (
        <HikerCreated
          hiker={step.hiker}
          password={step.password}
          onContinue={() =>
            setStep({kind: "booking", hiker: registered(step.hiker)})
          }
        />
      )}

      {step.kind === "temporary" && (
        <TemporaryHikerForm
          onDone={(hiker) => setStep({kind: "booking", hiker})}
          onCancel={toSearch}
        />
      )}

      {step.kind === "booking" && (
        <>
          <BookingFor hiker={step.hiker} onChange={toSearch} />
          <NewBooking
            hiker={step.hiker}
            onBooked={(booked) =>
              setStep({kind: "confirmed", hiker: step.hiker, booked})
            }
            onCancel={toSearch}
          />
        </>
      )}

      {step.kind === "confirmed" && (
        <>
          <BookingFor hiker={step.hiker} />
          <ReservationConfirmed booked={step.booked} onBack={toSearch} />
        </>
      )}
    </div>
  );
}
