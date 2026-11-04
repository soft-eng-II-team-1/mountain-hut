-- AlterTable
-- Optional requirements of the party (e.g. allergies), shown in the booking confirmation (MH-03)
ALTER TABLE "reservation" ADD COLUMN "requirements" TEXT;
