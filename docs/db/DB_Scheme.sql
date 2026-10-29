CREATE TYPE "user_role" AS ENUM (
  'hiker',
  'employee',
  'warden'
);

CREATE TABLE "reservation" (
  "reservation_id" uuid PRIMARY KEY,
  "people" integer NOT NULL CHECK (people > 0),
  "slot_id" uuid NOT NULL,
  "user_id" uuid NOT NULL
);

CREATE TABLE "table" (
  "table_id" uuid PRIMARY KEY,
  "number" string UNIQUE NOT NULL,
  "seats" integer NOT NULL CHECK (seats > 0)
);

CREATE TABLE "slot" (
  "slot_id" uuid PRIMARY KEY,
  "date_time_start" datetime NOT NULL,
  "date_time_end" datetime NOT NULL
);

CREATE TABLE "user" (
  "user_id" uuid PRIMARY KEY,
  "role" user_role NOT NULL,
  "name" string NOT NULL,
  "surname" string NOT NULL,
  "phone" string,
  "email" string UNIQUE NOT NULL,
  "hash" string NOT NULL,
  "salt" string NOT NULL
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

CREATE UNIQUE INDEX ON "reservation_table" ("reservation_id", "table_id");

CREATE UNIQUE INDEX ON "slot_table" ("slot_id", "table_id");

ALTER TABLE "reservation" ADD FOREIGN KEY ("slot_id") REFERENCES "slot" ("slot_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reservation" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reservation_table" ADD FOREIGN KEY ("reservation_id") REFERENCES "reservation" ("reservation_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "reservation_table" ADD FOREIGN KEY ("table_id") REFERENCES "table" ("table_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "slot_table" ADD FOREIGN KEY ("slot_id") REFERENCES "slot" ("slot_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "slot_table" ADD FOREIGN KEY ("table_id") REFERENCES "table" ("table_id") DEFERRABLE INITIALLY IMMEDIATE;
