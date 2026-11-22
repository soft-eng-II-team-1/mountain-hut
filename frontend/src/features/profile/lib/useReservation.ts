import {useEffect, useState} from "react";
import {getReservation} from "../../../api/reservations";
import type {ReservationDetails} from "../../../types";

type State =
  | {status: "loading"}
  | {status: "error"; error: string}
  | {status: "ready"; reservation: ReservationDetails};

// Loads one booking of the logged-in hiker
export function useReservation(reservationId: string | undefined) {
  const [loaded, setLoaded] = useState<{id: string; state: State} | null>(null);

  useEffect(() => {
    if (!reservationId) return;
    let active = true;
    getReservation(reservationId)
      .then((reservation) => {
        if (active)
          setLoaded({id: reservationId, state: {status: "ready", reservation}});
      })
      .catch((err: Error) => {
        if (active)
          setLoaded({id: reservationId, state: {status: "error", error: err.message}});
      });
    return () => {
      active = false;
    };
  }, [reservationId]);

  // a different id than the one loaded means the new one is still on its way
  return loaded && loaded.id === reservationId
    ? loaded.state
    : ({status: "loading"} as State);
}
