import 'dotenv/config';
import { prisma } from '../prisma.client.ts';
import UserDAO from '../src/dao/UserDAO.js';

const userDAO = new UserDAO();
const warden = await userDAO.createUser({
    name: 'Troy',
    surname: 'Bolton',
    email: process.env.WARDEN_EMAIL,
    password: process.env.WARDEN_PASSWORD,
    role: 'warden',
});

console.log(warden ? `Warden created successfully: ${warden.email}` : 'Warden already exists');
await prisma.$disconnect();