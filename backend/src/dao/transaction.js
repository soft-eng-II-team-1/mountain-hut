import { prisma } from '../../prisma.client.ts';

// How many times a transaction is retried when it collides with a concurrent one
const MAX_ATTEMPTS = 3;

// True if the transaction failed because of a concurrent one. Prisma reports it as P2034 when a
// query fails, but when the conflict is detected at COMMIT the driver adapter error is thrown
// as it is, with the PostgreSQL code 40001 (serialization_failure) in its cause
export const isSerializationConflict = (error) =>
    error?.code === 'P2034' || error?.cause?.originalCode === '40001';

// Runs `work(tx)` in a SERIALIZABLE transaction, like the bookings do (see ReservationDAO.saveReservation):
// PostgreSQL detects conflicts only between serializable transactions, so changes to slots and tables
// must use the same level to never interleave with a concurrent booking.
// If the transaction keeps failing because of concurrent ones (P2034), throws `conflictError()`
export const runSerializable = async (work, conflictError) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await prisma.$transaction(work, { isolationLevel: 'Serializable' });
        } catch (error) {
            if (!isSerializationConflict(error)) {
                throw error;
            }
            if (attempt >= MAX_ATTEMPTS) {
                throw conflictError();
            }
        }
    }
};
