import prisma from '../prismaClient.js';

class ReservationDAO {
  static async checkAvailability(slotId, partySize) {
    // 1. Fetch all tables assigned to this specific slot
    const slotTables = await prisma.slot_table.findMany({
      where: { slot_id: slotId },
      include: { table: true }
    });

    if (!slotTables.length) {
      throw new Error("No tables are assigned to this slot yet.");
    }

    // 2. Fetch all existing reservations for this slot to see what is taken
    const existingReservations = await prisma.reservation_table.findMany({
      where: { reservation: { slot_id: slotId } }
    });

    // 3. Calculate remaining capacity per table
    let totalAvailableSeats = 0;
    const availableTables = slotTables.map(st => {
      const tableId = st.table_id;
      const totalSeats = st.table.seats;
      
      // Sum seats already reserved on this specific table for this slot
      const seatsTaken = existingReservations
        .filter(rt => rt.table_id === tableId)
        .reduce((sum, rt) => sum + rt.seats_reserved, 0);

      const remainingSeats = totalSeats - seatsTaken;
      totalAvailableSeats += remainingSeats;

      return {
        table_id: tableId,
        number: st.table.number,
        remainingSeats
      };
    }).filter(table => table.remainingSeats > 0);

    // 4. Enforce business rule: check if total capacity meets the party size
    if (totalAvailableSeats < partySize) {
      return { available: false, totalAvailableSeats, availableTables: [] };
    }

    // Note for MH-43: The story requires keeping parties together. 
    // You will use this 'availableTables' array later to calculate the optimal split.
    return { 
      available: true, 
      totalAvailableSeats, 
      availableTables 
    };
  }
}

module.exports = ReservationDAO;