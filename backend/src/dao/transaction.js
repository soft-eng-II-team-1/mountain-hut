import { prisma } from '../../prisma.client.ts';

// How many times a transaction is retried when it collides with a concurrent one
const MAX_ATTEMPTS = 3;

// Runs `work(tx)` in a SERIALIZABLE transaction, like the bookings do (see ReservationDAO.saveReservation):
// PostgreSQL detects conflicts only between serializable transactions, so changes to slots and tables
// must use the same level to never interleave with a concurrent booking.
// If the transaction keeps failing because of concurrent ones (P2034), throws `conflictError()`
export const runSerializable = async (work, conflictError) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await prisma.$transaction(work, { isolationLevel: 'Serializable' });
        } catch (error) {
            if (error.code !== 'P2034') {
                throw error;
            }
            if (attempt >= MAX_ATTEMPTS) {
                throw conflictError();
            }
        }
    }
};
