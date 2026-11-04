import crypto from 'crypto';
import { prisma } from '../../prisma.client.ts';
import { runSerializable } from './transaction.js';

// Error with a code that the routes translate into an HTTP status
export class TableError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class TableDAO {
  static async getTables() {
    return await prisma.table.findMany({ orderBy: { number: 'asc' } });
  }

  static async createTable(tableData) {
    return await prisma.table.create({
      data: {
        table_id: crypto.randomUUID(), 
        number: tableData.number,
        seats: tableData.seats
      }
    });
  }

  // The seats cannot go below the seats already reserved on the table in a slot that is not over,
  // otherwise that slot would have more customers than it can serve
  static async updateTable(tableId, updateData) {
    return runSerializable(async (tx) => {
      const reservations = await tx.reservation_table.findMany({
        where: { table_id: tableId, reservation: { slot: { date_time_end: { gt: new Date() } } } },
        select: { seats_reserved: true, reservation: { select: { slot_id: true } } }
      });

      // Seats reserved on this table in each slot
      const reservedBySlot = {};
      for (const r of reservations) {
        const slotId = r.reservation.slot_id;
        reservedBySlot[slotId] = (reservedBySlot[slotId] ?? 0) + r.seats_reserved;
      }
      const maxReserved = Object.values(reservedBySlot).reduce((max, seats) => Math.max(max, seats), 0);

      if (updateData.seats < maxReserved) {
        throw new TableError('SEATS_RESERVED', `Cannot set fewer seats than the ${maxReserved} already reserved on this table in a slot`);
      }

      return await tx.table.update({
        where: { table_id: tableId },
        data: {
          number: updateData.number,
          seats: updateData.seats
        }
      });
    }, () => new TableError('CONCURRENT_UPDATE', 'The table is being modified by someone else, please try again'));
  }

  static async deleteTable(tableId) {
    const activeBooking = await prisma.reservation_table.findFirst({ where: { table_id: tableId } });
    const scheduledSlot = await prisma.slot_table.findFirst({ where: { table_id: tableId } });

    if (activeBooking || scheduledSlot) {
      throw new Error("Cannot delete a table that is scheduled in a slot or has active reservations");
    }

    return await prisma.table.delete({ where: { table_id: tableId } });
  }
}

export default TableDAO;