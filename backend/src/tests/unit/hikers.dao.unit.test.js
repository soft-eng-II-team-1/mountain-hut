// MH-07 - Reserve for a hiker
import {jest} from "@jest/globals";

const prismaMock = {
  user: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.unstable_mockModule("../../../prisma.client.ts", () => ({
  prisma: prismaMock,
}));

const {default: UserDAO} = await import("../../dao/UserDAO.js");
const userDao = new UserDAO();

const lastWhere = () => prismaMock.user.findMany.mock.calls.at(-1)[0].where;

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.$queryRaw.mockResolvedValue([]);
});

describe("UserDAO.createUser", () => {
  it("stores first_login for the accounts created by the staff", async () => {
    prismaMock.user.create.mockImplementation(async ({data}) => data);

    await userDao.createUser({
      name: "Anna",
      surname: "Bianchi",
      email: "anna@test.it",
      password: "Abc23defGH",
      first_login: true,
    });

    expect(prismaMock.user.create.mock.calls[0][0].data.first_login).toBe(true);
  });
});

describe("UserDAO.searchHikers", () => {
  it("looks only for hikers and matches the email exactly, ignoring the case", async () => {
    await userDao.searchHikers({email: "anna@test.it"});

    expect(lastWhere().AND).toEqual([
      {role: "hiker"},
      {email: {equals: "anna@test.it", mode: "insensitive"}},
    ]);
  });

  it("requires every word of the name to be in the name or in the surname", async () => {
    await userDao.searchHikers({name: "rossi mar"});

    expect(lastWhere().AND).toEqual([
      {role: "hiker"},
      {OR: [{name: {contains: "rossi", mode: "insensitive"}}, {surname: {contains: "rossi", mode: "insensitive"}}]},
      {OR: [{name: {contains: "mar", mode: "insensitive"}}, {surname: {contains: "mar", mode: "insensitive"}}]},
    ]);
  });

  it("matches part of the phone ignoring the spaces", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{user_id: "hiker-1"}]);

    await userDao.searchHikers({phone: "333 123"});

    const [, pattern] = prismaMock.$queryRaw.mock.calls[0];
    expect(pattern).toBe("%333123%");
    expect(lastWhere().AND).toContainEqual({user_id: {in: ["hiker-1"]}});
  });
});
