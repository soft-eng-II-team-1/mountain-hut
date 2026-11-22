// MH-07 - Reserve for a hiker
import {jest} from "@jest/globals";
import express from "express";
import request from "supertest";

const reservationDaoMock = {
  saveEmployeeReservation: jest.fn(),
};

class ReservationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
jest.unstable_mockModule("../../dao/ReservationDAO.js", () => ({
  default: reservationDaoMock,
  ReservationError,
}));
jest.unstable_mockModule("../../services/reservationConfirmation.js", () => ({
  sendReservationConfirmation: jest.fn(),
}));

const {default: reservationRoutes} =
  await import("../../routes/reservations.js");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const role = req.get("x-test-role");
  req.isAuthenticated = () => Boolean(role);
  req.user = role ? {user_id: "employee-1", role} : undefined;
  next();
});
app.use("/api", reservationRoutes);

const SLOT_ID = "11111111-1111-4111-8111-111111111111";
const HIKER_ID = "33333333-3333-4333-8333-333333333333";
const forHikerUrl = `/api/slots/${SLOT_ID}/reservations/for-hiker`;

const book = (body, role = "employee") =>
  request(app).post(forHikerUrl).set("x-test-role", role).send(body);

const fields = (res) => res.body.errors.map((e) => e.field);

beforeEach(() => {
  jest.resetAllMocks();
  reservationDaoMock.saveEmployeeReservation.mockResolvedValue({
    reservation_id: "reservation-1",
  });
});

describe("POST /api/slots/:slotId/reservations/for-hiker", () => {
  it("responds 403 to a hiker", async () => {
    await book({people: 2, user_id: HIKER_ID}, "hiker").expect(403);

    expect(reservationDaoMock.saveEmployeeReservation).not.toHaveBeenCalled();
  });

  it("books for a registered hiker", async () => {
    await book({people: 2, user_id: HIKER_ID}).expect(201);

    expect(reservationDaoMock.saveEmployeeReservation).toHaveBeenCalledWith({
      slotId: SLOT_ID,
      people: 2,
      userId: HIKER_ID,
      temporaryName: null,
      temporaryPhone: null,
      requirements: [],
    });
  });

  it("books for a temporary contact, with name and phone trimmed", async () => {
    await book({
      people: 2,
      temporary_name: " Mario Rossi ",
      temporary_phone: " +39 3331234567 ",
    }).expect(201);

    expect(reservationDaoMock.saveEmployeeReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        temporaryName: "Mario Rossi",
        temporaryPhone: "+39 3331234567",
      }),
    );
  });

  it.each([
    ["people is not a positive integer", {people: 0, user_id: HIKER_ID}, "people"],
    ["both user_id and a temporary contact are given", {people: 2, user_id: HIKER_ID, temporary_name: "Mario"}, "user_id"],
    ["neither user_id nor temporary_name are given", {people: 2}, "temporary_name"],
  ])("responds 422 if %s", async (_, body, field) => {
    const res = await book(body).expect(422);

    expect(fields(res)).toEqual([field]);
    expect(reservationDaoMock.saveEmployeeReservation).not.toHaveBeenCalled();
  });

  it.each([
    [404, "Hiker not found"],
    [409, "You already have a reservation for this time slot"],
    [400, "Reservations must be made before the slot starts"],
    [500, "DB down"],
  ])("responds %i when the DAO throws \"%s\"", async (status, message) => {
    reservationDaoMock.saveEmployeeReservation.mockRejectedValue(new Error(message));

    const res = await book({people: 2, user_id: HIKER_ID}).expect(status);

    expect(res.body).toEqual({error: message});
  });
});
