-- Sammelzone für Orte ohne eigene Lieferzone („مناطق أخرى“).
-- Adressen können den Ort frei eingeben; ohne Treffer landen sie hier und
-- die Verwaltung ordnet sie bei Bedarf einer Zone zu. Gebühren sind änderbar.
INSERT INTO "DeliveryZone" ("id", "code", "nameAr", "nameEn", "active", "sortOrder", "deliveryWeekdays")
SELECT 'zone_other', 'OTHER', 'مناطق أخرى', 'Other areas', true, 990, '{}'
WHERE NOT EXISTS (SELECT 1 FROM "DeliveryZone" WHERE "code" = 'OTHER');

INSERT INTO "DeliveryZoneRate" ("id", "zoneId", "channel", "feeGrossAgorot", "minOrderAgorot", "freeFromAgorot")
SELECT 'zone_other_b2c', z."id", 'B2C', 3500, 12000, 60000 FROM "DeliveryZone" z
WHERE z."code" = 'OTHER' AND NOT EXISTS (SELECT 1 FROM "DeliveryZoneRate" r WHERE r."zoneId" = z."id" AND r."channel" = 'B2C');

INSERT INTO "DeliveryZoneRate" ("id", "zoneId", "channel", "feeGrossAgorot", "minOrderAgorot", "freeFromAgorot")
SELECT 'zone_other_b2b', z."id", 'B2B', 5000, 120000, 350000 FROM "DeliveryZone" z
WHERE z."code" = 'OTHER' AND NOT EXISTS (SELECT 1 FROM "DeliveryZoneRate" r WHERE r."zoneId" = z."id" AND r."channel" = 'B2B');
