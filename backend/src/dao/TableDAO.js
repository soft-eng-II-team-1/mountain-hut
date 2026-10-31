import crypto from 'crypto';
import { prisma } from '../../prisma.client.ts';

class TableDAO {
  static async createTable(tableData) {
    return await prisma.table.create({
      data: {
        table_id: crypto.randomUUID(), 
        number: tableData.number,
        seats: tableData.seats
      }
    });
  }

  static async updateTable(tableId, updateData) {
    return await prisma.table.update({
      where: { table_id: tableId },
      data: {
        number: updateData.number,
        seats: updateData.seats
      }
    });
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