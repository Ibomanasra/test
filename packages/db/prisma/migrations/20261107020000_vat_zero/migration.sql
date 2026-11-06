-- MwSt. vorerst 0 % (Wunsch des Betreibers). Der bisher gültige Satz endet jetzt,
-- ein neuer Satz 0 % gilt ab jetzt. Ausgestellte Belege behalten ihren Satz (Snapshot).
-- Wieder einschalten: Verwaltung → Einstellungen → Steuer (Schalter).
-- Nur wenn aktuell ein Satz ≠ 0 offen ist; frische Datenbanken setzt der Seed.
WITH open_rate AS (
  UPDATE "TaxRate" SET "validTo" = date_trunc('milliseconds', now() AT TIME ZONE 'UTC')
  WHERE "code" = 'STANDARD' AND "validTo" IS NULL AND "rateBps" <> 0
    AND "validFrom" <= now() AT TIME ZONE 'UTC'
  RETURNING "validTo"
)
INSERT INTO "TaxRate" ("id", "code", "rateBps", "validFrom", "validTo")
SELECT 'vat_zero_' || md5(random()::text), 'STANDARD', 0, "validTo", NULL FROM open_rate;
