-- Mitarbeiter melden sich mit Benutzername + Passwort an
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Bestehende Mitarbeiter: Inhaber → "admin", alle anderen → "user" + letzte 4 Ziffern der Nummer
UPDATE "User" u SET "username" = 'admin'
WHERE u."id" = (
  SELECT ur."userId" FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId" JOIN "User" x ON x."id" = ur."userId"
  WHERE r."key" = 'owner' AND x."kind" = 'STAFF' ORDER BY x."createdAt" ASC LIMIT 1
);
UPDATE "User" SET "username" = 'user' || right(regexp_replace("phone", '\D', '', 'g'), 4) || '_' || substr("id", length("id") - 3)
WHERE "kind" = 'STAFF' AND "username" IS NULL;
