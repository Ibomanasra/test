-- Angebote gelten exakt wie eingegeben: die mitgelieferte Beispielregel „endet auf ,90“
-- (B2C, ab 0, Reihenfolge 10) nicht mehr auf Angebotspreise anwenden.
UPDATE "RoundingRule"
SET "appliesToPromotions" = false
WHERE "channel" = 'B2C' AND "mode" = 'END_90' AND "minAgorot" = 0 AND "sortOrder" = 10 AND "appliesToBasePrices" = false;
