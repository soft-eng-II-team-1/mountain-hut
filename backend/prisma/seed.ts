import { PrismaClient, user_role } from '../generated/prisma/client';
import crypto, { randomUUID } from 'node:crypto';

import { prisma } from '../prisma.client';

/**
 * Helper per generare salt e hash compatibili con il tuo userDAO
 */
function hashPassword(password: string): { salt: string; hash: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hashBuffer = crypto.scryptSync(password, salt, 64);
    const hash = hashBuffer.toString('hex');
    return { salt, hash };
}

async function main() {
    console.log('🌱 Avvio popolamento del database...');

    // Password predefinita per tutti gli utenti di test
    const defaultPassword = 'Password123!';
    console.log(`🔑 Password usata per tutti gli utenti di mock: "${defaultPassword}"`);

    // 1. Pulizia tabelle (in ordine inverso di dipendenza per i vincoli di Foreign Key)
    console.log('🧹 Pulizia dati esistenti...');
    await prisma.reservation_table.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.slot_table.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.table.deleteMany();
    await prisma.user.deleteMany();

    // 2. Creazione Utenti con hashing e tipo enum 'user_role'
    console.log('👤 Creazione utenti...');

    const wardenAuth = hashPassword(defaultPassword);
    const wardenUser = await prisma.user.create({
        data: {
            user_id: randomUUID(),
            name: 'Mario',
            surname: 'Rossi',
            email: 'warden@rifugio.it',
            phone: '+393331234567',
            role: user_role.warden,
            salt: wardenAuth.salt,
            hash: wardenAuth.hash,
        },
    });

    const employeeAuth = hashPassword(defaultPassword);
    const employeeUser = await prisma.user.create({
        data: {
            user_id: randomUUID(),
            name: 'Luca',
            surname: 'Bianchi',
            email: 'employee@rifugio.it',
            phone: '+393337654321',
            role: user_role.employee,
            salt: employeeAuth.salt,
            hash: employeeAuth.hash,
        },
    });

    const hikerAuth = hashPassword(defaultPassword);
    const hikerUser = await prisma.user.create({
        data: {
            user_id: randomUUID(),
            name: 'Giulia',
            surname: 'Verdi',
            email: 'hiker.giulia@example.com',
            phone: '+393401122334',
            role: user_role.hiker,
            salt: hikerAuth.salt,
            hash: hikerAuth.hash,
        },
    });

    // 3. Creazione Tavoli
    console.log('🍽️ Creazione tavoli...');
    const tablesData = [
        { number: 'T01', seats: 2 },
        { number: 'T02', seats: 4 },
        { number: 'T03', seats: 4 },
        { number: 'T04', seats: 6 },
        { number: 'T05', seats: 8 },
    ];

    const createdTables = [];
    for (const t of tablesData) {
        const table = await prisma.table.create({
            data: {
                table_id: randomUUID(),
                number: t.number,
                seats: t.seats,
            },
        });
        createdTables.push(table);
    }

    // 4. Creazione Slot Orari (Pranzo e Cena per i prossimi 2 giorni)
    console.log('⏰ Creazione slot orari...');
    const createdSlots = [];
    const today = new Date();

    for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const baseDate = new Date(today);
        baseDate.setDate(today.getDate() + dayOffset);

        // Slot Pranzo (12:30 - 14:30)
        const lunchStart = new Date(baseDate);
        lunchStart.setHours(12, 30, 0, 0);
        const lunchEnd = new Date(baseDate);
        lunchEnd.setHours(14, 30, 0, 0);

        const lunchSlot = await prisma.slot.create({
            data: {
                slot_id: randomUUID(),
                date_time_start: lunchStart,
                date_time_end: lunchEnd,
            },
        });
        createdSlots.push(lunchSlot);

        // Slot Cena (19:30 - 21:30)
        const dinnerStart = new Date(baseDate);
        dinnerStart.setHours(19, 30, 0, 0);
        const dinnerEnd = new Date(baseDate);
        dinnerEnd.setHours(21, 30, 0, 0);

        const dinnerSlot = await prisma.slot.create({
            data: {
                slot_id: randomUUID(),
                date_time_start: dinnerStart,
                date_time_end: dinnerEnd,
            },
        });
        createdSlots.push(dinnerSlot);
    }

    // 5. Assegnazione Tavoli agli Slot (`slot_table`)
    console.log('🔗 Associazione tavoli agli slot...');
    for (const slot of createdSlots) {
        for (const table of createdTables) {
            await prisma.slot_table.create({
                data: {
                    id: randomUUID(),
                    slot_id: slot.slot_id,
                    table_id: table.table_id,
                },
            });
        }
    }

    // 6. Creazione Prenotazione di Test
    console.log('📅 Creazione prenotazione e assegnazione tavolo...');
    const targetSlot = createdSlots[0];
    const targetTable = createdTables[1];

    const reservation = await prisma.reservation.create({
        data: {
            reservation_id: randomUUID(),
            people: 3,
            slot_id: targetSlot.slot_id,
            user_id: hikerUser.user_id,
        },
    });

    await prisma.reservation_table.create({
        data: {
            id: randomUUID(),
            reservation_id: reservation.reservation_id,
            table_id: targetTable.table_id,
            seats_reserved: 3,
        },
    });

    console.log('✅ Seed completato con successo!');
    console.log('--- Credenziali create ---');
    console.log(`• Warden:   warden@rifugio.it / ${defaultPassword}`);
    console.log(`• Employee: employee@rifugio.it / ${defaultPassword}`);
    console.log(`• Hiker:    hiker.giulia@example.com / ${defaultPassword}`);
}

main()
    .catch((e) => {
        console.error('❌ Errore durante il seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });