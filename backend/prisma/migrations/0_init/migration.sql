-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('hiker', 'employee', 'warden');

-- CreateTable
CREATE TABLE "reservation" (
    "reservation_id" UUID NOT NULL,
    "people" INTEGER NOT NULL,
    "slot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "reservation_table" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "seats_reserved" INTEGER NOT NULL,

    CONSTRAINT "reservation_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot" (
    "slot_id" UUID NOT NULL,
    "date_time_start" TIMESTAMPTZ(6) NOT NULL,
    "date_time_end" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "slot_pkey" PRIMARY KEY ("slot_id")
);

-- CreateTable
CREATE TABLE "slot_table" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,

    CONSTRAINT "slot_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table" (
    "table_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,

    CONSTRAINT "table_pkey" PRIMARY KEY ("table_id")
);

-- CreateTable
CREATE TABLE "user" (
    "user_id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservation_table_reservation_id_table_id_idx" ON "reservation_table"("reservation_id", "table_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_table_slot_id_table_id_idx" ON "slot_table"("slot_id", "table_id");

-- CreateIndex
CREATE UNIQUE INDEX "table_number_key" ON "table"("number");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slot"("slot_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_table" ADD CONSTRAINT "reservation_table_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("reservation_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservation_table" ADD CONSTRAINT "reservation_table_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "table"("table_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "slot_table" ADD CONSTRAINT "slot_table_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slot"("slot_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "slot_table" ADD CONSTRAINT "slot_table_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "table"("table_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

