-- Fotos de documento: slots frente y dorso (Client) + marcas de subida en check-in online.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoFrontStoredName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoFrontOriginalName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoFrontMimeType" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoFrontSizeBytes" INTEGER;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoFrontUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoBackStoredName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoBackOriginalName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoBackMimeType" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoBackSizeBytes" INTEGER;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentPhotoBackUpdatedAt" TIMESTAMP(3);

ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentFrontUploadedAt" TIMESTAMP(3);
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentBackUploadedAt" TIMESTAMP(3);
