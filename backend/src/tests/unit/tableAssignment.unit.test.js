import { assignTables } from '../../services/tableAssignment.js';

// Helper: builds the "availableTables" input as returned by ReservationDAO.checkAvailability
const tables = (...list) => list.map(([number, remainingSeats]) => ({
    table_id: `id-${number}`,
    number,
    remainingSeats,
}));

// Helper: total seats assigned by an assignment
const totalAssigned = (assignment) => assignment.reduce((sum, t) => sum + t.seats_reserved, 0);

// Checks the invariants that every valid assignment must respect
const expectValidAssignment = (assignment, available, people) => {
    expect(assignment).not.toBeNull();
    expect(totalAssigned(assignment)).toBe(people);

    const ids = assignment.map((t) => t.table_id);
    expect(new Set(ids).size).toBe(ids.length); // no table used twice

    for (const t of assignment) {
        const source = available.find((a) => a.table_id === t.table_id);
        expect(source).toBeDefined();
        expect(t.seats_reserved).toBeGreaterThan(0);
        expect(t.seats_reserved).toBeLessThanOrEqual(source.remainingSeats);
    }
};

describe('assignTables - whole party at one table', () => {
    it('uses the only table when it fits exactly', () => {
        const available = tables(['T1', 4]);

        const result = assignTables(available, 4);

        expect(result).toEqual([{ table_id: 'id-T1', number: 'T1', seats_reserved: 4 }]);
    });

    it('chooses the smallest table that fits the whole party (best fit)', () => {
        const available = tables(['T1', 2], ['T2', 4], ['T3', 6]);

        const result = assignTables(available, 3);

        expect(result).toEqual([{ table_id: 'id-T2', number: 'T2', seats_reserved: 3 }]);
    });

    it('prefers one table to a split, even if the split would use fewer free seats', () => {
        // 2 + 2 = 4 would be a smaller set of seats, but one table keeps the party together
        const available = tables(['T1', 6], ['T2', 2], ['T3', 2]);

        const result = assignTables(available, 4);

        expect(result).toEqual([{ table_id: 'id-T1', number: 'T1', seats_reserved: 4 }]);
    });

    it('shares a table that is partially occupied by another party', () => {
        // T1 has 6 seats but only 2 are still free
        const available = tables(['T1', 2], ['T2', 8]);

        const result = assignTables(available, 2);

        expect(result).toEqual([{ table_id: 'id-T1', number: 'T1', seats_reserved: 2 }]);
    });

    it('seats a party of one at the table with the fewest free seats', () => {
        const available = tables(['T1', 6], ['T2', 1], ['T3', 3]);

        const result = assignTables(available, 1);

        expect(result).toEqual([{ table_id: 'id-T2', number: 'T2', seats_reserved: 1 }]);
    });

    it('breaks ties between equal tables deterministically by table number', () => {
        const available = tables(['T2', 4], ['T1', 4]);

        const result = assignTables(available, 3);

        expect(result).toEqual([{ table_id: 'id-T1', number: 'T1', seats_reserved: 3 }]);
    });
});

describe('assignTables - party split over more tables', () => {
    it('splits only when no single table is big enough', () => {
        const available = tables(['T1', 4], ['T2', 4], ['T3', 3]);

        const result = assignTables(available, 7);

        expectValidAssignment(result, available, 7);
        expect(result).toHaveLength(2);
    });

    it('among sets with the same number of tables, uses the smallest set of free seats', () => {
        // 2 tables: 4+3 = 7 seats is better than 4+4 = 8 seats
        const available = tables(['T1', 4], ['T2', 4], ['T3', 3]);

        const result = assignTables(available, 7);

        const numbers = result.map((t) => t.number).sort();
        expect(numbers).toContain('T3');
        expect(result.map((t) => t.seats_reserved).sort()).toEqual([3, 4]);
    });

    it('uses as few tables as possible, even if more tables would use fewer free seats', () => {
        // 3 tables (2+2+2 = 6) would be an exact fit, but 2 tables (5+2 = 7) are fewer
        const available = tables(['T1', 5], ['T2', 5], ['T3', 2], ['T4', 2], ['T5', 2]);

        const result = assignTables(available, 6);

        expectValidAssignment(result, available, 6);
        expect(result).toHaveLength(2);
        expect(result.map((t) => t.number)).toContain('T1');
    });

    it('keeps the largest possible group together when splitting', () => {
        // 5 + 3 is the only 2-table option: 5 people at the bigger table, 1 at the other
        const available = tables(['T1', 3], ['T2', 5]);

        const result = assignTables(available, 6);

        expect(result).toEqual([
            { table_id: 'id-T2', number: 'T2', seats_reserved: 5 },
            { table_id: 'id-T1', number: 'T1', seats_reserved: 1 },
        ]);
    });

    it('uses all the tables when the party equals the total free seats', () => {
        const available = tables(['T1', 2], ['T2', 3], ['T3', 4]);

        const result = assignTables(available, 9);

        expectValidAssignment(result, available, 9);
        expect(result).toHaveLength(3);
    });

    it('gives a valid assignment with the minimum number of tables on a larger case', () => {
        const available = tables(['T1', 8], ['T2', 6], ['T3', 6], ['T4', 4], ['T5', 2], ['T6', 2], ['T7', 1]);

        const result = assignTables(available, 19);

        expectValidAssignment(result, available, 19);
        // 8 + 6 + 6 = 20 >= 19 is the best with 3 tables; no 2 tables reach 19
        expect(result).toHaveLength(3);
        expect(result.reduce((s, t) => s + available.find((a) => a.table_id === t.table_id).remainingSeats, 0)).toBe(20);
    });
});

describe('assignTables - impossible cases and input handling', () => {
    it('returns null when the party is bigger than all the free seats', () => {
        const available = tables(['T1', 2], ['T2', 3]);

        expect(assignTables(available, 6)).toBeNull();
    });

    it('returns null when there are no tables', () => {
        expect(assignTables([], 1)).toBeNull();
    });

    it('ignores full tables (0 free seats)', () => {
        const available = tables(['T1', 0], ['T2', 3]);

        const result = assignTables(available, 2);

        expect(result).toEqual([{ table_id: 'id-T2', number: 'T2', seats_reserved: 2 }]);
    });

    it('returns null when all the tables are full', () => {
        const available = tables(['T1', 0], ['T2', 0]);

        expect(assignTables(available, 1)).toBeNull();
    });

    it('does not modify the input array', () => {
        const available = tables(['T1', 2], ['T2', 6], ['T3', 4]);
        const copy = structuredClone(available);

        assignTables(available, 7);

        expect(available).toEqual(copy);
    });
});