-- Startseite: eigene Texte und Hintergrundbild
ALTER TABLE "CompanySettings" ADD COLUMN "heroTitleAr" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "heroTitleEn" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "heroTextAr" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "heroTextEn" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "heroImageFileId" TEXT;
