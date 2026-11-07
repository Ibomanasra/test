-- Gelöschte, aber bereits verkaufte Produkte werden archiviert
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);
