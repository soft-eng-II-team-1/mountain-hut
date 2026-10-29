CREATE TYPE "user_role" AS ENUM (
  'hiker',
  'employee',
  'warden'
);

CREATE TABLE "slot" (
  "slot_id" uuid PRIMARY KEY,
  "date_time_start" timestamptz NOT NULL,
  "date_time_end" timestamptz NOT NULL
);

CREATE TABLE "user" (
  "user_id" uuid PRIMARY KEY,
  "role" user_role NOT NULL,
  "name" text NOT NULL,
  "surname" text NOT NULL,
  "phone" text,
  "email" text UNIQUE NOT NULL,
  "hash" text NOT NULL,
  "salt" text NOT NULL
);

CREATE TABLE "table" (
  "table_id" uuid PRIMARY KEY,
  "number" text UNIQUE NOT NULL,
  "seats" integer NOT NULL CHECK (seats > 0)
);

CREATE TABLE "reservation" (
  "reservation_id" uuid PRIMARY KEY,
  "people" integer NOT NULL CHECK (people > 0),
  "slot_id" uuid NOT NULL,
  "user_id" uuid NOT NULL
);

CREATE TABLE "reservation_table" (
  "id" uuid PRIMARY KEY,
  "reservation_id" uuid NOT NULL,
  "table_id" uuid NOT NULL,
  "seats_reserved" integer NOT NULL
);

CREATE TABLE "slot_table" (
  "id" uuid PRIMARY KEY,
  "slot_id" uuid NOT NULL,
  "table_id" uuid NOT NULL
);

CREATE UNIQUE INDEX "reservation_table_reservation_id_table_id_idx" ON "reservation_table" ("reservation_id", "table_id");

CREATE UNIQUE INDEX "slot_table_slot_id_table_id_idx" ON "slot_table" ("slot_id", "table_id");

ALTER TABLE "reservation" ADD FOREIGN KEY ("slot_id") REFERENCES "slot" ("slot_id");

ALTER TABLE "reservation" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("user_id");

ALTER TABLE "reservation_table" ADD FOREIGN KEY ("reservation_id") REFERENCES "reservation" ("reservation_id");

ALTER TABLE "reservation_table" ADD FOREIGN KEY ("table_id") REFERENCES "table" ("table_id");

ALTER TABLE "slot_table" ADD FOREIGN KEY ("slot_id") REFERENCES "slot" ("slot_id");

ALTER TABLE "slot_table" ADD FOREIGN KEY ("table_id") REFERENCES "table" ("table_id");