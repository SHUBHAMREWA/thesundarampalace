-- Phase 3 integrity rules that Prisma's schema language can't express
-- (docs/database-design.md §4, architecture.md ADR-15). Hand-written.

-- 1. No two CONFIRMED occupancies of the same physical hall may overlap.
--    Ranges include the setup/teardown buffers and are half-open, so an event
--    ending at 15:00 does not clash with one starting at 15:00. Holds and
--    tentative reservations are excluded (the service reports them as warnings),
--    and an authorised override sets "allowOverlap".
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "slot_occupancy"
  ADD CONSTRAINT "slot_occupancy_no_confirmed_overlap"
  EXCLUDE USING gist (
    "physicalHallId" WITH =,
    tstzrange("effectiveStartsAt", "effectiveEndsAt", '[)') WITH &&
  )
  WHERE ("state" = 'CONFIRMED' AND NOT "allowOverlap");

ALTER TABLE "slot_occupancy"
  ADD CONSTRAINT "slot_occupancy_range_valid" CHECK ("effectiveEndsAt" > "effectiveStartsAt");
ALTER TABLE "slot_reservation"
  ADD CONSTRAINT "slot_reservation_range_valid" CHECK ("endsAt" > "startsAt");
ALTER TABLE "booking_sub_event"
  ADD CONSTRAINT "booking_sub_event_range_valid" CHECK ("endsAt" > "startsAt");

-- 2. Money sanity checks (amounts are always positive; direction says which way).
ALTER TABLE "ledger_entry"
  ADD CONSTRAINT "ledger_entry_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "ledger_entry_direction_matches_type" CHECK (
    ("type" = 'PAYMENT' AND "direction" = 'IN')
    OR ("type" = 'REFUND' AND "direction" = 'OUT')
    OR "type" = 'ADJUSTMENT'
  ),
  ADD CONSTRAINT "ledger_entry_adjustment_has_reason" CHECK (
    "type" <> 'ADJUSTMENT' OR length(btrim(coalesce("reason", ''))) > 0
  );
ALTER TABLE "deposit_entry"
  ADD CONSTRAINT "deposit_entry_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payment_instalment"
  ADD CONSTRAINT "payment_instalment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "quotation_line"
  ADD CONSTRAINT "quotation_line_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "quotation_line_amounts_valid" CHECK ("unitPrice" >= 0 AND "discount" >= 0 AND "allocatedDiscount" >= 0);
ALTER TABLE "post_event_charge"
  ADD CONSTRAINT "post_event_charge_quantity_positive" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "tax_rate"
  ADD CONSTRAINT "tax_rate_range" CHECK ("ratePercent" >= 0 AND "ratePercent" <= 100);
ALTER TABLE "sub_event_menu_selection"
  ADD CONSTRAINT "sub_event_menu_selection_plates_positive" CHECK ("guaranteedPlates" > 0 AND ("actualPlates" IS NULL OR "actualPlates" >= 0));

-- 3. Append-only financial and history tables (forbid_update_delete() comes
--    from the Phase 1 migration). Corrections are new rows, never edits.
CREATE TRIGGER ledger_entry_append_only
  BEFORE UPDATE OR DELETE ON "ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER deposit_entry_append_only
  BEFORE UPDATE OR DELETE ON "deposit_entry"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER post_event_charge_append_only
  BEFORE UPDATE OR DELETE ON "post_event_charge"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER invoice_line_append_only
  BEFORE UPDATE OR DELETE ON "invoice_line"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER credit_note_append_only
  BEFORE UPDATE OR DELETE ON "credit_note"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER credit_note_line_append_only
  BEFORE UPDATE OR DELETE ON "credit_note_line"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER booking_status_history_append_only
  BEFORE UPDATE OR DELETE ON "booking_status_history"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();
CREATE TRIGGER generated_document_append_only
  BEFORE UPDATE OR DELETE ON "generated_document"
  FOR EACH ROW EXECUTE FUNCTION forbid_update_delete();

-- 4. Issued invoices: only "status" may change (when credit notes are issued).
CREATE OR REPLACE FUNCTION invoice_status_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Issued invoices cannot be deleted; issue a credit note instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Issued invoices are immutable; only the status can change'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_immutable
  BEFORE UPDATE OR DELETE ON "invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_status_only();

-- 5. Quotation versions are immutable once they leave DRAFT: only the
--    status (SENT → ACCEPTED/SUPERSEDED, ACCEPTED → SUPERSEDED) and its
--    timestamps may change, and only drafts can be deleted.
CREATE OR REPLACE FUNCTION quotation_version_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Only draft quotations can be deleted' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'DRAFT' THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'sentAt', 'acceptedAt', 'acceptedById', 'updatedAt'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'sentAt', 'acceptedAt', 'acceptedById', 'updatedAt']) THEN
    RAISE EXCEPTION 'Quotation version % is %; create a new version instead', OLD."versionNumber", OLD."status"
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'SENT' AND NEW."status" IN ('ACCEPTED', 'SUPERSEDED'))
    OR (OLD."status" = 'ACCEPTED' AND NEW."status" = 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'Quotation status cannot change from % to %', OLD."status", NEW."status"
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_version_immutable
  BEFORE UPDATE OR DELETE ON "quotation_version"
  FOR EACH ROW EXECUTE FUNCTION quotation_version_guard();

-- Lines of a non-draft version can't be added, changed or removed. (When a
-- draft version is deleted its lines cascade; the parent is gone by then.)
CREATE OR REPLACE FUNCTION quotation_line_guard() RETURNS trigger AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT "status" INTO parent_status
    FROM "quotation_version"
   WHERE "id" = CASE WHEN TG_OP = 'DELETE' THEN OLD."versionId" ELSE NEW."versionId" END;
  IF parent_status IS NOT NULL AND parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Lines of a % quotation cannot be changed', parent_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."versionId" <> OLD."versionId" THEN
    RAISE EXCEPTION 'Quotation lines cannot move between versions' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_line_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON "quotation_line"
  FOR EACH ROW EXECUTE FUNCTION quotation_line_guard();

-- 6. Customer search by partial name.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "customer_fullName_trgm_idx" ON "customer" USING gin ("fullName" gin_trgm_ops);
