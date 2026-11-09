-- Anonyme Besucherstatistik
CREATE TABLE "VisitEvent" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "vid" VARCHAR(40) NOT NULL,
    "type" VARCHAR(12) NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(160),
    "variantId" VARCHAR(40),
    "query" VARCHAR(80),
    "entry" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(24),
    "device" VARCHAR(12),
    "app" BOOLEAN NOT NULL DEFAULT false,
    "locale" VARCHAR(5),
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "VisitEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VisitEvent_day_type_idx" ON "VisitEvent"("day", "type");
CREATE INDEX "VisitEvent_at_idx" ON "VisitEvent"("at");
CREATE INDEX "VisitEvent_vid_idx" ON "VisitEvent"("vid");
