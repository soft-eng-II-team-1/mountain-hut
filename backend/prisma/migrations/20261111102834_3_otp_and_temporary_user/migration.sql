-- AlterTable
ALTER TABLE "reservation" ADD COLUMN     "has_allergies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "temporary_name" TEXT,
ADD COLUMN     "temporary_phone" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "first_login" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "otp_user" (
    "otp_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "otp_user_pkey" PRIMARY KEY ("otp_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_user_user_id_key" ON "otp_user"("user_id");

-- AddForeignKey
ALTER TABLE "otp_user" ADD CONSTRAINT "otp_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
