-- AlterTable
ALTER TABLE "slot" ADD COLUMN     "menu" TEXT;

-- CreateTable
CREATE TABLE "hike" (
    "hike_id" UUID NOT NULL,
    "destination" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "waypoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date_time_start" TIMESTAMPTZ(6) NOT NULL,
    "date_time_end" TIMESTAMPTZ(6) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "hiker_id" UUID NOT NULL,

    CONSTRAINT "hike_pkey" PRIMARY KEY ("hike_id")
);

-- CreateTable
CREATE TABLE "popular_hike" (
    "popular_hike_id" UUID NOT NULL,
    "destination" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "waypoints" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "popular_hike_pkey" PRIMARY KEY ("popular_hike_id")
);

-- AddForeignKey
ALTER TABLE "hike" ADD CONSTRAINT "hike_hiker_id_fkey" FOREIGN KEY ("hiker_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
