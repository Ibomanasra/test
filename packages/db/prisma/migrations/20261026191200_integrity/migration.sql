-- =============================================================================
-- Integritätsregeln, die Prisma nicht im Schema ausdrücken kann.
--   1. CHECK-Constraints (Beträge, Prozent, "genau eines von"-Beziehungen)
--   2. Unveränderlichkeit von Rechnungen, Gutschriften, Archiv, Journalen
--
-- Wartungs-Ausnahme: Das Demo-Daten-Löschskript setzt in seiner Transaktion
--   SET LOCAL sa.allow_purge = 'on';
-- Nur dann sind DELETEs auf geschützten Tabellen erlaubt.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CHECK-Constraints
-- ---------------------------------------------------------------------------

ALTER TABLE "TaxRate"
  ADD CONSTRAINT "TaxRate_rate_chk" CHECK ("rateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "TaxRate_validity_chk" CHECK ("validTo" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "CompanySettings"
  ADD CONSTRAINT "CompanySettings_singleton_chk" CHECK ("id" = 1),
  ADD CONSTRAINT "CompanySettings_margin_chk" CHECK ("minMarginBps" BETWEEN 0 AND 10000);

ALTER TABLE "RoundingRule" ADD CONSTRAINT "RoundingRule_min_chk" CHECK ("minAgorot" >= 0);

ALTER TABLE "DeliveryZoneRate"
  ADD CONSTRAINT "DeliveryZoneRate_amounts_chk"
  CHECK ("feeGrossAgorot" >= 0 AND "minOrderAgorot" >= 0 AND ("freeFromAgorot" IS NULL OR "freeFromAgorot" >= 0));

ALTER TABLE "NumberSequence"
  ADD CONSTRAINT "NumberSequence_next_chk" CHECK ("nextNumber" >= 1),
  ADD CONSTRAINT "NumberSequence_padding_chk" CHECK ("padding" BETWEEN 1 AND 12);

ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "RateLimitBucket_count_chk" CHECK ("count" >= 0);
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_attempts_chk" CHECK ("attempts" >= 0);

ALTER TABLE "CustomerGroup"
  ADD CONSTRAINT "CustomerGroup_discount_chk" CHECK ("discountBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "CustomerGroup_pricelist_chk"
  CHECK ("pricingMode" <> 'PRICE_LIST' OR "priceListId" IS NOT NULL);

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_credit_chk" CHECK ("creditLimitAgorot" >= 0),
  ADD CONSTRAINT "Customer_terms_chk" CHECK ("paymentTermDays" IS NULL OR "paymentTermDays" BETWEEN 0 AND 365),
  ADD CONSTRAINT "Customer_b2b_fields_chk"
  CHECK ("type" = 'B2C' OR ("companyName" IS NOT NULL AND "dealerNumber" IS NOT NULL));

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_prices_chk"
  CHECK ("costPrice" >= 0 AND "b2cPrice" >= 0 AND "b2bBasePrice" >= 0 AND "minStock" >= 0);

ALTER TABLE "VariantUnit" ADD CONSTRAINT "VariantUnit_factor_chk" CHECK ("factor" >= 1);

ALTER TABLE "VariantChannelRule"
  ADD CONSTRAINT "VariantChannelRule_qty_chk" CHECK ("minQtyBase" >= 1 AND "qtyStepBase" >= 1);

ALTER TABLE "PriceListItem"
  ADD CONSTRAINT "PriceListItem_price_chk" CHECK ("priceNet" >= 0),
  ADD CONSTRAINT "PriceListItem_validity_chk" CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "TierPrice"
  ADD CONSTRAINT "TierPrice_chk" CHECK ("minQtyBase" >= 1 AND "priceNet" >= 0),
  ADD CONSTRAINT "TierPrice_validity_chk" CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "CustomerPrice"
  ADD CONSTRAINT "CustomerPrice_price_chk" CHECK ("priceNet" >= 0),
  ADD CONSTRAINT "CustomerPrice_validity_chk" CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "CategoryDiscount"
  ADD CONSTRAINT "CategoryDiscount_target_chk" CHECK (num_nonnulls("groupId", "customerId") = 1),
  ADD CONSTRAINT "CategoryDiscount_discount_chk" CHECK ("discountBps" BETWEEN 0 AND 10000);

ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_period_chk" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "Promotion_percent_chk"
  CHECK ("type" <> 'PERCENT' OR ("percentBps" IS NOT NULL AND "percentBps" BETWEEN 1 AND 10000)),
  ADD CONSTRAINT "Promotion_bxgy_chk"
  CHECK ("type" <> 'BUY_X_GET_Y' OR ("buyQty" >= 1 AND "getQty" >= 1));

ALTER TABLE "PromotionTarget"
  ADD CONSTRAINT "PromotionTarget_target_chk" CHECK (num_nonnulls("variantId", "productId", "categoryId") = 1),
  ADD CONSTRAINT "PromotionTarget_price_chk" CHECK ("fixedPrice" IS NULL OR "fixedPrice" >= 0);

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "QuoteItem_chk" CHECK ("qty" >= 1 AND "unitFactor" >= 1 AND "unitPriceNet" >= 0);

ALTER TABLE "ScheduledPriceChange"
  ADD CONSTRAINT "ScheduledPriceChange_chk" CHECK ("newPrice" >= 0 AND "field" IN ('COST', 'B2C', 'B2B_BASE'));

ALTER TABLE "StockLevel"
  ADD CONSTRAINT "StockLevel_nonneg_chk" CHECK ("onHand" >= 0 AND "reserved" >= 0);

ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_qty_chk" CHECK ("qtyBase" >= 1);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_qty_chk" CHECK ("qtyBase" <> 0);

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_qty_chk" CHECK ("qty" >= 1);
ALTER TABLE "SavedOrderListItem" ADD CONSTRAINT "SavedOrderListItem_qty_chk" CHECK ("qty" >= 1);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_totals_chk" CHECK ("subtotalNet" + "vatTotal" = "totalGross"),
  ADD CONSTRAINT "Order_amounts_chk" CHECK ("subtotalNet" >= 0 AND "vatTotal" >= 0 AND "deliveryFeeGross" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_qty_chk" CHECK ("qty" >= 1 AND "unitFactor" >= 1 AND "qtyBase" = "qty" * "unitFactor"),
  ADD CONSTRAINT "OrderItem_line_chk" CHECK ("lineNet" + "lineVat" = "lineGross"),
  ADD CONSTRAINT "OrderItem_progress_chk"
  CHECK ("qtyPickedBase" >= 0 AND "qtyDeliveredBase" >= 0 AND "qtyCancelledBase" >= 0
         AND "qtyDeliveredBase" + "qtyCancelledBase" <= "qtyBase");

ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_qty_chk" CHECK ("qtyBase" >= 1);

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_chk" CHECK ("qty" >= 1 AND "unitFactor" >= 1 AND "unitCostNet" >= 0 AND "receivedQtyBase" >= 0);
ALTER TABLE "GoodsReceiptItem"
  ADD CONSTRAINT "GoodsReceiptItem_chk" CHECK ("qtyBase" >= 1 AND "unitCostNet" >= 0);

ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_amount_chk" CHECK ("amount" >= 0);
ALTER TABLE "TourStop" ADD CONSTRAINT "TourStop_cod_chk" CHECK ("codExpected" >= 0 AND "sequence" >= 1);

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_totals_chk" CHECK ("subtotalNet" + "vatTotal" = "totalGross"),
  ADD CONSTRAINT "Invoice_paid_chk" CHECK ("paidAmount" >= 0 AND "creditedAmount" >= 0),
  ADD CONSTRAINT "Invoice_due_chk" CHECK ("dueDate" >= "issueDate");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_chk" CHECK ("lineNet" + "lineVat" = "lineGross");

ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_totals_chk" CHECK ("subtotalNet" + "vatTotal" = "totalGross");
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_chk" CHECK ("lineNet" + "lineVat" = "lineGross");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_chk" CHECK ("amount" > 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_chk" CHECK ("amount" > 0);

ALTER TABLE "CustomerLedgerEntry"
  ADD CONSTRAINT "CustomerLedgerEntry_chk" CHECK ("debit" >= 0 AND "credit" >= 0 AND ("debit" > 0 OR "credit" > 0));

ALTER TABLE "DunningNotice" ADD CONSTRAINT "DunningNotice_level_chk" CHECK ("level" BETWEEN 1 AND 3);

ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_expected_chk" CHECK ("expected" >= 0);

-- Hinweis: "eine Standardadresse pro Kunde" und "ein Standardlager" werden in
-- der Service-Schicht transaktional sichergestellt (Prisma kennt keine partiellen Indizes).

-- ---------------------------------------------------------------------------
-- 2. Unveränderlichkeit
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sa_purge_allowed() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('sa.allow_purge', true), '') = 'on'
$$;

-- Nur-anhängen: kein UPDATE/DELETE. Im Wartungsmodus (Demo-Daten löschen) sind
-- DELETE und das Nullen von Fremdschlüsseln (ON DELETE SET NULL) erlaubt.
CREATE OR REPLACE FUNCTION sa_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF sa_purge_allowed() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'table "%" is append-only (% not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION sa_append_only();
CREATE TRIGGER "CustomerLedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "CustomerLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION sa_append_only();
CREATE TRIGGER "StockMovement_append_only" BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION sa_append_only();
CREATE TRIGGER "PriceHistory_append_only" BEFORE UPDATE OR DELETE ON "PriceHistory"
  FOR EACH ROW EXECUTE FUNCTION sa_append_only();
CREATE TRIGGER "InvoiceLine_immutable" BEFORE UPDATE OR DELETE ON "InvoiceLine"
  FOR EACH ROW EXECUTE FUNCTION sa_append_only();
CREATE TRIGGER "CreditNoteLine_immutable" BEFORE UPDATE OR DELETE ON "CreditNoteLine"
  FOR EACH ROW EXECUTE FUNCTION sa_append_only();

-- Rechnung: nach Ausstellung nur noch Zahlungs-/Gutschriftsstand und
-- einmalig die Archiv-Referenz änderbar. Löschen nie (außer Wartung).
CREATE OR REPLACE FUNCTION sa_invoice_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF sa_purge_allowed() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'invoices cannot be deleted – issue a credit note instead' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW."archivedDocId" IS DISTINCT FROM OLD."archivedDocId") AND OLD."archivedDocId" IS NOT NULL THEN
    RAISE EXCEPTION 'archived invoice PDF cannot be replaced' USING ERRCODE = 'P0001';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'paidAmount', 'creditedAmount', 'archivedDocId'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'paidAmount', 'creditedAmount', 'archivedDocId']) THEN
    RAISE EXCEPTION 'invoice % is immutable', OLD."number" USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Invoice_immutable" BEFORE UPDATE OR DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION sa_invoice_guard();

CREATE OR REPLACE FUNCTION sa_credit_note_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF sa_purge_allowed() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'credit notes cannot be deleted' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW."archivedDocId" IS DISTINCT FROM OLD."archivedDocId") AND OLD."archivedDocId" IS NOT NULL THEN
    RAISE EXCEPTION 'archived credit note PDF cannot be replaced' USING ERRCODE = 'P0001';
  END IF;
  IF (to_jsonb(NEW) - 'archivedDocId') IS DISTINCT FROM (to_jsonb(OLD) - 'archivedDocId') THEN
    RAISE EXCEPTION 'credit note % is immutable', OLD."number" USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "CreditNote_immutable" BEFORE UPDATE OR DELETE ON "CreditNote"
  FOR EACH ROW EXECUTE FUNCTION sa_credit_note_guard();

-- Eingefrorene Archiv-PDFs sind unveränderlich
CREATE OR REPLACE FUNCTION sa_archive_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."frozen" THEN
    IF TG_OP = 'DELETE' AND sa_purge_allowed() THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'frozen document % cannot be changed', OLD."number" USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ArchivedDocument_frozen" BEFORE UPDATE OR DELETE ON "ArchivedDocument"
  FOR EACH ROW EXECUTE FUNCTION sa_archive_guard();
