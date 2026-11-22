// MH-07 - Reserve for a hiker
import {
  generatePassword,
  GENERATED_PASSWORD_LENGTH,
} from "../../services/passwordGenerator.js";

describe("generatePassword", () => {
  it("generates 10 characters without the ones easy to confuse (0 O o 1 l I)", () => {
    const password = generatePassword();

    expect(GENERATED_PASSWORD_LENGTH).toBe(10);
    expect(password).toHaveLength(10);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]+$/);
  });

  it("generates a different password each time", () => {
    const passwords = new Set(Array.from({length: 50}, () => generatePassword()));

    expect(passwords.size).toBe(50);
  });
});
