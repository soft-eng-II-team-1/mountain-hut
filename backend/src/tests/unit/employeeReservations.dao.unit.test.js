// MH-07 - Reserve for a hiker
import {jest} from "@jest/globals";

const tx = {
  slot: {findUnique: jest.fn()},
  slot_table: {findMany: jest.fn()},
  user: {findUnique: jest.fn()},
  reservation: {findFirst: jest.fn(), create: jest.fn()},
  reservation_table: {findMany: jest.fn(), createMany: jest.fn()},
};

const prismaMock = {
  ...tx,
  $transaction: jest.fn(),
};

jest.unstable_mockModule("../../../prisma.client.ts", () => ({
  prisma: prismaMock,
}));

const {default: ReservationDAO} = await import("../../dao/ReservationDAO.js");

const MINUTE = 60 * 1000;
const SLOT_ID = "slot-1";
const HIKER_ID = "hiker-1";

const slotStartingIn = (ms) => ({
  slot_id: SLOT_ID,
  date_time_start: new Date(Date.now() + ms),
  date_time_end: new Date(Date.now() + ms + 60 * MINUTE),
});

// slot in 3 days, registered hiker, no previous booking, one empty table of 6 seats
const setupValidBooking = () => {
  tx.slot.findUnique.mockResolvedValue(slotStartingIn(72 * 60 * MINUTE));
  tx.user.findUnique.mockResolvedValue({role: "hiker"});
  tx.reservation.findFirst.mockResolvedValue(null);
  tx.slot_table.findMany.mockResolvedValue([
    {slot_id: SLOT_ID, table_id: "id-T1", table: {table_id: "id-T1", number: "T1", seats: 6}},
  ]);
  tx.reservation_table.findMany.mockResolvedValue([]);
  tx.reservation.create.mockImplementation(async ({data}) => data);
  tx.reservation_table.createMany.mockResolvedValue({count: 1});
};

const book = (input) =>
  ReservationDAO.saveEmployeeReservation({slotId: SLOT_ID, people: 2, ...input});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (callback) => callback(tx));
  setupValidBooking();
});

describe("ReservationDAO.saveEmployeeReservation", () => {
  it("creates the reservation for a registered hiker", async () => {
    await book({userId: HIKER_ID});

    expect(tx.reservation.create.mock.calls[0][0].data).toMatchObject({
      people: 2,
      slot_id: SLOT_ID,
      user_id: HIKER_ID,
    });
  });

  it("creates the reservation for a temporary contact, without looking up any account", async () => {
    await book({temporaryName: "Mario Rossi", temporaryPhone: "+39 3331234567"});

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.reservation.create.mock.calls[0][0].data).toMatchObject({
      user_id: null,
      temporary_name: "Mario Rossi",
      temporary_phone: "+39 3331234567",
    });
  });

  it("throws if the user is not a hiker", async () => {
    tx.user.findUnique.mockResolvedValue({role: "employee"});

    await expect(book({userId: HIKER_ID})).rejects.toThrow("Hiker not found");
    expect(tx.reservation.create).not.toHaveBeenCalled();
  });

  it("throws if the hiker already has a reservation for the slot", async () => {
    tx.reservation.findFirst.mockResolvedValue({reservation_id: "existing"});

    await expect(book({userId: HIKER_ID})).rejects.toThrow(
      "You already have a reservation for this time slot",
    );
  });

  it("accepts a booking less than 2 hours before the slot starts", async () => {
    tx.slot.findUnique.mockResolvedValue(slotStartingIn(30 * MINUTE));

    await book({userId: HIKER_ID});

    expect(tx.reservation.create).toHaveBeenCalledTimes(1);
  });

  it("throws if the slot has already started", async () => {
    tx.slot.findUnique.mockResolvedValue(slotStartingIn(-MINUTE));

    await expect(book({userId: HIKER_ID})).rejects.toThrow(
      "Reservations must be made before the slot starts",
    );
  });
});
