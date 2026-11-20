
-- CreateTable
CREATE TABLE "reservation_requirement" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "allergies" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,

    CONSTRAINT "reservation_requirement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservation_requirement_description_check" CHECK (char_length("description") BETWEEN 1 AND 500)
);

-- CreateIndex
CREATE INDEX "reservation_requirement_reservation_id_idx" ON "reservation_requirement"("reservation_id");

-- AddForeignKey
ALTER TABLE "reservation_requirement" ADD CONSTRAINT "reservation_requirement_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("reservation_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- MigrateData: each existing text requirement becomes one entry of the list, keeping its allergy flag
INSERT INTO "reservation_requirement" ("id", "reservation_id", "allergies", "description")
SELECT gen_random_uuid(), "reservation_id", "has_allergies", LEFT(BTRIM("requirements"), 500)
FROM "reservation"
WHERE "requirements" IS NOT NULL AND BTRIM("requirements") <> '';

-- AlterTable
ALTER TABLE "reservation" DROP COLUMN "requirements";