-- Add draft status to SeasonBlock
ALTER TABLE "SeasonBlock" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SeasonBlock" ADD COLUMN "lastSavedAt" TIMESTAMP(3);

-- Add draft status to SeasonPrice
ALTER TABLE "SeasonPrice" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- Add draft status to BlockServiceSelection
ALTER TABLE "BlockServiceSelection" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false; 