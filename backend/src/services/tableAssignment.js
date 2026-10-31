/**
 * Table assignment logic for MH-01 ("Book a table").
 *
 * Rules (from the user story clarifications):
 *  - Sharing a table with other parties is the standard rule.
 *  - Try to seat the whole party at ONE table first.
 *  - Split the party only when no single table has enough free seats,
 *    and in that case use AS FEW TABLES AS POSSIBLE.
 *  - Among the options with the same number of tables, occupy the
 *    SMALLEST set of free seats (i.e. the best fit, leaving the larger
 *    free blocks available for the next parties).
 *
 * This module is pure (no DB access) so it can be reused by other stories
 * (e.g. MH-06, modify a reservation) and unit-tested in isolation.
 */

/**
 * Chooses the tables for a party.
 *
 * @param {Array<{ table_id: string, number: string, remainingSeats: number }>} availableTables
 *        tables of the slot with their free seats (output of ReservationDAO.checkAvailability)
 * @param {number} people party size
 * @returns {Array<{ table_id: string, number: string, seats_reserved: number }> | null}
 *          the assignment, or null if the party cannot be seated
 */
export function assignTables(availableTables, people) {
    // 1. Keep only tables with free seats. Sorting makes the result deterministic.
    const tables = availableTables
        .filter(t => t.remainingSeats > 0)
        .sort((a, b) => b.remainingSeats - a.remainingSeats || a.number.localeCompare(b.number));

    // 2. 0/1 knapsack on the number of tables:
    //    combos[k] maps "total free seats" -> indexes of one set of k tables with that total.
    //    Only one set per (k, total) is kept, so the size is bounded by tables * seats.
    const combos = [new Map([[0, []]])];

    for (let i = 0; i < tables.length; i++) {
        // Walk k downwards so table i is never added twice to the same set
        for (let k = combos.length - 1; k >= 0; k--) {
            for (const [total, indexes] of combos[k]) {
                // The set already seats the party: adding tables can only make it worse
                if (total >= people) continue;

                const newTotal = total + tables[i].remainingSeats;
                if (!combos[k + 1]) combos[k + 1] = new Map();
                if (!combos[k + 1].has(newTotal)) combos[k + 1].set(newTotal, [...indexes, i]);
            }
        }
    }

    // 3. Smallest number of tables first (k = 1 is the "whole party at one table" case),
    //    then the smallest total of free seats that still fits the party.
    for (let k = 1; k < combos.length; k++) {
        const fittingTotals = [...combos[k].keys()].filter(total => total >= people);
        if (fittingTotals.length === 0) continue;

        const bestTotal = Math.min(...fittingTotals);
        const chosenTables = combos[k].get(bestTotal).map(i => tables[i]);
        return distributeParty(chosenTables, people);
    }

    return null;
}

/**
 * Splits the party over the chosen tables, filling the biggest ones first so the
 * largest possible group sits together. Since the set of tables is minimal, every
 * table receives at least one person.
 */
function distributeParty(chosenTables, people) {
    let remainingPeople = people;

    return [...chosenTables]
        .sort((a, b) => b.remainingSeats - a.remainingSeats)
        .map(t => {
            const seats = Math.min(t.remainingSeats, remainingPeople);
            remainingPeople -= seats;
            return { table_id: t.table_id, number: t.number, seats_reserved: seats };
        });
}
