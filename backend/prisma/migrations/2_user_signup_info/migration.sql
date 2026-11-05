-- AlterTable
-- Optional info given by the hiker at sign up: notes (e.g. "registered mountain guide") and an emergency contact
ALTER TABLE "user" ADD COLUMN "notes" TEXT;
ALTER TABLE "user" ADD COLUMN "emergency_contact" TEXT;
