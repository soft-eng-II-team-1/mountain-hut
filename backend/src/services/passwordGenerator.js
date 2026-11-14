import crypto from 'node:crypto';

//MH-7

// The generated password is told to the hiker aloud, so the characters that are
// easy to confuse are left out: 0/O/o, 1/l/I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// 10 characters out of 56 possible, complies with the 8-128 limits of the signup password
export const GENERATED_PASSWORD_LENGTH = 10;

/**
 * Random password for the hiker accounts created by the staff.
 * Uses crypto.randomInt (CSPRNG, uniform): never Math.random.
 *
 * @param {number} [length]
 * @returns {string}
 */
export function generatePassword(length = GENERATED_PASSWORD_LENGTH) {
    let password = '';
    for (let i = 0; i < length; i++) {
        password += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    return password;
}
