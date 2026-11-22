// MH-07 - Reserve for a hiker
import {jest} from "@jest/globals";
import express from "express";
import request from "supertest";

const userDaoMock = {
  createUser: jest.fn(),
  searchHikers: jest.fn(),
};

jest.unstable_mockModule("../../dao/UserDAO.js", () => ({
  default: function UserDAO() {
    return userDaoMock;
  },
}));
jest.unstable_mockModule("../../services/passwordGenerator.js", () => ({
  generatePassword: () => "Abc23defGH",
}));

const {default: hikerRoutes} = await import("../../routes/hikers.js");
const {default: hikerSearchRoutes} = await import("../../routes/hikerSearch.js");
const {requirePasswordChange} = await import("../../middlewares/auth.js");

// "x-test-first-login" marks a user that has not changed the generated password yet
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const role = req.get("x-test-role");
  req.isAuthenticated = () => Boolean(role);
  req.user = role
    ? {user_id: "user-1", role, first_login: req.get("x-test-first-login") === "true"}
    : undefined;
  next();
});
app.use(requirePasswordChange);
app.use("/api/hikers", hikerSearchRoutes);
app.use("/api/hikers", hikerRoutes);
app.get("/api/auth/current", (req, res) => res.status(200).json(req.user));

const newHiker = {
  name: "Anna",
  surname: "Bianchi",
  email: "anna@test.it",
};

const create = (body, role = "employee") =>
  request(app).post("/api/hikers").set("x-test-role", role).send(body);
const search = (query, role = "employee") =>
  request(app).get("/api/hikers").query(query).set("x-test-role", role);

beforeEach(() => {
  jest.resetAllMocks();
  userDaoMock.createUser.mockResolvedValue({
    user_id: "hiker-1",
    email: "anna@test.it",
    role: "hiker",
  });
  userDaoMock.searchHikers.mockResolvedValue([]);
});

describe("POST /api/hikers", () => {
  it("responds 403 to a hiker", async () => {
    await create(newHiker, "hiker").expect(403);

    expect(userDaoMock.createUser).not.toHaveBeenCalled();
  });

  it("creates a hiker with a generated password, ignoring password and role in the body", async () => {
    const res = await create({...newHiker, password: "mine", role: "warden"}).expect(201);

    expect(userDaoMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({password: "Abc23defGH", role: "hiker", first_login: true}),
    );
    expect(res.body.generated_password).toBe("Abc23defGH");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("responds 409 if the email is already registered", async () => {
    userDaoMock.createUser.mockResolvedValue(null);

    await create(newHiker).expect(409);
  });

  it("responds 422 if the email is not valid", async () => {
    await create({...newHiker, email: "anna"}).expect(422);

    expect(userDaoMock.createUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/hikers", () => {
  it("responds 403 to a hiker", async () => {
    await search({name: "Anna"}, "hiker").expect(403);
  });

  it("passes the given criteria trimmed, with the email in lowercase", async () => {
    await search({email: " Anna@Test.IT ", name: " Anna "}).expect(200);

    expect(userDaoMock.searchHikers).toHaveBeenCalledWith({
      email: "anna@test.it",
      name: "Anna",
      phone: undefined,
    });
  });

  it("responds 422 if no criterion is given", async () => {
    await search({}).expect(422);

    expect(userDaoMock.searchHikers).not.toHaveBeenCalled();
  });
});

describe("requirePasswordChange", () => {
  it("responds 403 before the generated password is changed", async () => {
    const res = await search({name: "Anna"}, "hiker")
      .set("x-test-first-login", "true")
      .expect(403);

    expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("lets the /api/auth routes through", async () => {
    await request(app)
      .get("/api/auth/current")
      .set("x-test-role", "hiker")
      .set("x-test-first-login", "true")
      .expect(200);
  });
});
