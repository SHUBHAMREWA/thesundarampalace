-- CreateEnum
CREATE TYPE "PricingRuleKind" AS ENUM ('SEASON', 'WEEKDAY', 'DATE');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('ENQUIRY_HOLD', 'TENTATIVE', 'QUOTATION_SENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationState" AS ENUM ('HOLD', 'TENTATIVE', 'CONFIRMED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('BRIDE', 'GROOM');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SupplyType" AS ENUM ('INTRA', 'INTER');

-- CreateEnum
CREATE TYPE "LineKind" AS ENUM ('PACKAGE', 'PLATES', 'SERVICE', 'CUSTOM', 'EXTRA_PLATES');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('PAYMENT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD_OFFLINE', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DepositEntryType" AS ENUM ('RECEIVED', 'DEDUCTION', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PostEventChargeKind" AS ENUM ('EXTRA_PLATES', 'EXTRA_HOURS', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_CREDITED', 'FULLY_CREDITED');

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "package" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "crmPrice" DECIMAL(12,2),
ADD COLUMN     "minPlates" INTEGER,
ADD COLUMN     "perPlateRate" DECIMAL(12,2),
ADD COLUMN     "taxCategoryId" TEXT;

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "companyName" TEXT,
    "maritalStatus" TEXT,
    "dateOfBirth" DATE,
    "anniversary" DATE,
    "spouseName" TEXT,
    "categoryKey" TEXT,
    "professionKey" TEXT,
    "professionOther" TEXT,
    "stateCode" TEXT,
    "city" TEXT,
    "locality" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "mergedIntoId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "anonymizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_merge_review" (
    "id" TEXT NOT NULL,
    "primaryId" TEXT NOT NULL,
    "duplicateId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_merge_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_document" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partyId" TEXT,
    "category" TEXT NOT NULL,
    "label" TEXT,
    "purpose" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedById" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_blob" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_blob_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "hall_composition" (
    "compositeHallId" TEXT NOT NULL,
    "memberHallId" TEXT NOT NULL,

    CONSTRAINT "hall_composition_pkey" PRIMARY KEY ("compositeHallId","memberHallId")
);

-- CreateTable
CREATE TABLE "slot_definition" (
    "id" TEXT NOT NULL,
    "hallId" TEXT,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "slot_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tax_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rate" (
    "id" TEXT NOT NULL,
    "taxCategoryId" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "defaultPrice" DECIMAL(12,2),
    "taxCategoryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_package" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "perPlateRate" DECIMAL(12,2) NOT NULL,
    "minPlates" INTEGER,
    "selectionRules" JSONB NOT NULL,
    "taxCategoryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PricingRuleKind" NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "weekdays" JSONB,
    "dates" JSONB,
    "adjustmentType" "AdjustmentType" NOT NULL,
    "adjustmentValue" DECIMAL(12,2) NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pricing_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slabs" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cancellation_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "leadId" TEXT,
    "mainEventName" TEXT NOT NULL,
    "mainEventTypeKey" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'ENQUIRY_HOLD',
    "startDate" DATE,
    "endDate" DATE,
    "expectedGuests" INTEGER,
    "packageId" TEXT,
    "ownerId" TEXT,
    "placeOfSupplyStateCode" TEXT,
    "acceptedQuotationId" TEXT,
    "cancellationPolicySnapshot" JSONB,
    "depositRequired" DECIMAL(12,2),
    "notes" TEXT,
    "internalInstructions" TEXT,
    "confirmedAt" TIMESTAMPTZ(3),
    "confirmedById" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellation" JSONB,
    "createdById" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_sub_event" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventTypeKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hallId" TEXT NOT NULL,
    "slotDefinitionId" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "expectedGuests" INTEGER,
    "assignedToId" TEXT,
    "specialInstructions" TEXT,
    "internalNotes" TEXT,
    "dietaryNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "booking_sub_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_reservation" (
    "id" TEXT NOT NULL,
    "subEventId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "state" "ReservationState" NOT NULL,
    "holdExpiresAt" TIMESTAMPTZ(3),
    "holdReminderSentAt" TIMESTAMPTZ(3),
    "waitlistPosition" INTEGER,
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "slot_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_occupancy" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "physicalHallId" TEXT NOT NULL,
    "effectiveStartsAt" TIMESTAMPTZ(3) NOT NULL,
    "effectiveEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "state" "ReservationState" NOT NULL,
    "allowOverlap" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "slot_occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bride_groom_party" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "altPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bride_groom_party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_event_menu_selection" (
    "id" TEXT NOT NULL,
    "subEventId" TEXT NOT NULL,
    "menuPackageId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "guaranteedPlates" INTEGER NOT NULL,
    "actualPlates" INTEGER,
    "actualRecordedAt" TIMESTAMPTZ(3),
    "actualRecordedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sub_event_menu_selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_version" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "pricesIncludeTax" BOOLEAN NOT NULL,
    "supplyType" "SupplyType" NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "roundGrandTotal" BOOLEAN NOT NULL DEFAULT false,
    "bookingDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cgstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "validUntil" DATE,
    "terms" TEXT,
    "notes" TEXT,
    "snapshot" JSONB,
    "sentAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotation_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "LineKind" NOT NULL,
    "subEventId" TEXT,
    "subEventLabel" TEXT,
    "description" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allocatedDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRatePercent" DECIMAL(5,2) NOT NULL,
    "taxableValue" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "taxCategoryId" TEXT,
    "source" JSONB,

    CONSTRAINT "quotation_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "method" "PaymentMethod",
    "transactionRef" TEXT,
    "receiptNumber" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "reversesEntryId" TEXT,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_instalment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reminderSentOn" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_instalment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_entry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "DepositEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "method" "PaymentMethod",
    "transactionRef" TEXT,
    "reason" TEXT,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_event_charge" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "subEventId" TEXT,
    "kind" "PostEventChargeKind" NOT NULL,
    "description" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxRatePercent" DECIMAL(5,2) NOT NULL,
    "pricesIncludeTax" BOOLEAN NOT NULL,
    "supplyType" "SupplyType" NOT NULL,
    "taxableValue" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_event_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,
    "quotationVersionId" TEXT,
    "issuedOn" DATE NOT NULL,
    "supplier" JSONB NOT NULL,
    "recipient" JSONB NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "supplyType" "SupplyType" NOT NULL,
    "pricesIncludeTax" BOOLEAN NOT NULL,
    "taxableTotal" DECIMAL(12,2) NOT NULL,
    "cgstTotal" DECIMAL(12,2) NOT NULL,
    "sgstTotal" DECIMAL(12,2) NOT NULL,
    "igstTotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "roundOff" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "amountInWords" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "issuedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "taxableValue" DECIMAL(12,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "quotationLineId" TEXT,
    "postEventChargeId" TEXT,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "supplyType" "SupplyType" NOT NULL,
    "taxableTotal" DECIMAL(12,2) NOT NULL,
    "cgstTotal" DECIMAL(12,2) NOT NULL,
    "sgstTotal" DECIMAL(12,2) NOT NULL,
    "igstTotal" DECIMAL(12,2) NOT NULL,
    "taxTotal" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "amountInWords" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_line" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceLineId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sacCode" TEXT NOT NULL,
    "taxableValue" DECIMAL(12,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "credit_note_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_document" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "reference" TEXT NOT NULL,
    "sourceId" TEXT,
    "version" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT,
    "sizeBytes" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_reference_key" ON "customer"("reference");

-- CreateIndex
CREATE INDEX "customer_mobile_idx" ON "customer"("mobile");

-- CreateIndex
CREATE INDEX "customer_fullName_idx" ON "customer"("fullName");

-- CreateIndex
CREATE INDEX "customer_deletedAt_createdAt_idx" ON "customer"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "customer_merge_review_status_createdAt_idx" ON "customer_merge_review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_merge_review_primaryId_duplicateId_key" ON "customer_merge_review"("primaryId", "duplicateId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_document_storageKey_key" ON "customer_document"("storageKey");

-- CreateIndex
CREATE INDEX "customer_document_customerId_createdAt_idx" ON "customer_document"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_document_partyId_idx" ON "customer_document"("partyId");

-- CreateIndex
CREATE INDEX "hall_composition_memberHallId_idx" ON "hall_composition"("memberHallId");

-- CreateIndex
CREATE INDEX "slot_definition_hallId_active_sortOrder_idx" ON "slot_definition"("hallId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_taxCategoryId_effectiveFrom_key" ON "tax_rate"("taxCategoryId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "service_item_active_sortOrder_idx" ON "service_item"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "menu_package_menuId_idx" ON "menu_package"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_reference_key" ON "booking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "booking_acceptedQuotationId_key" ON "booking"("acceptedQuotationId");

-- CreateIndex
CREATE INDEX "booking_customerId_idx" ON "booking"("customerId");

-- CreateIndex
CREATE INDEX "booking_status_startDate_idx" ON "booking"("status", "startDate");

-- CreateIndex
CREATE INDEX "booking_startDate_idx" ON "booking"("startDate");

-- CreateIndex
CREATE INDEX "booking_ownerId_idx" ON "booking"("ownerId");

-- CreateIndex
CREATE INDEX "booking_sub_event_bookingId_sortOrder_idx" ON "booking_sub_event"("bookingId", "sortOrder");

-- CreateIndex
CREATE INDEX "booking_sub_event_hallId_startsAt_idx" ON "booking_sub_event"("hallId", "startsAt");

-- CreateIndex
CREATE INDEX "booking_sub_event_date_idx" ON "booking_sub_event"("date");

-- CreateIndex
CREATE INDEX "booking_sub_event_assignedToId_date_idx" ON "booking_sub_event"("assignedToId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "slot_reservation_subEventId_key" ON "slot_reservation"("subEventId");

-- CreateIndex
CREATE INDEX "slot_reservation_state_holdExpiresAt_idx" ON "slot_reservation"("state", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "slot_reservation_hallId_startsAt_idx" ON "slot_reservation"("hallId", "startsAt");

-- CreateIndex
CREATE INDEX "slot_occupancy_physicalHallId_effectiveStartsAt_idx" ON "slot_occupancy"("physicalHallId", "effectiveStartsAt");

-- CreateIndex
CREATE INDEX "slot_occupancy_reservationId_idx" ON "slot_occupancy"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "bride_groom_party_bookingId_role_key" ON "bride_groom_party"("bookingId", "role");

-- CreateIndex
CREATE INDEX "booking_status_history_bookingId_createdAt_idx" ON "booking_status_history"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sub_event_menu_selection_subEventId_key" ON "sub_event_menu_selection"("subEventId");

-- CreateIndex
CREATE INDEX "sub_event_menu_selection_menuPackageId_idx" ON "sub_event_menu_selection"("menuPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_version_bookingId_versionNumber_key" ON "quotation_version"("bookingId", "versionNumber");

-- CreateIndex
CREATE INDEX "quotation_line_versionId_sortOrder_idx" ON "quotation_line"("versionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_receiptNumber_key" ON "ledger_entry"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_reversesEntryId_key" ON "ledger_entry"("reversesEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entry_idempotencyKey_key" ON "ledger_entry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_entry_bookingId_occurredOn_idx" ON "ledger_entry"("bookingId", "occurredOn");

-- CreateIndex
CREATE INDEX "ledger_entry_occurredOn_idx" ON "ledger_entry"("occurredOn");

-- CreateIndex
CREATE INDEX "payment_instalment_bookingId_dueOn_idx" ON "payment_instalment"("bookingId", "dueOn");

-- CreateIndex
CREATE INDEX "payment_instalment_dueOn_idx" ON "payment_instalment"("dueOn");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_entry_idempotencyKey_key" ON "deposit_entry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "deposit_entry_bookingId_createdAt_idx" ON "deposit_entry"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_event_charge_idempotencyKey_key" ON "post_event_charge"("idempotencyKey");

-- CreateIndex
CREATE INDEX "post_event_charge_bookingId_idx" ON "post_event_charge"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_number_key" ON "invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_idempotencyKey_key" ON "invoice"("idempotencyKey");

-- CreateIndex
CREATE INDEX "invoice_bookingId_idx" ON "invoice"("bookingId");

-- CreateIndex
CREATE INDEX "invoice_issuedOn_idx" ON "invoice"("issuedOn");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_financialYear_sequence_key" ON "invoice"("financialYear", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_line_postEventChargeId_key" ON "invoice_line"("postEventChargeId");

-- CreateIndex
CREATE INDEX "invoice_line_invoiceId_sortOrder_idx" ON "invoice_line"("invoiceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_number_key" ON "credit_note"("number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_idempotencyKey_key" ON "credit_note"("idempotencyKey");

-- CreateIndex
CREATE INDEX "credit_note_invoiceId_idx" ON "credit_note"("invoiceId");

-- CreateIndex
CREATE INDEX "credit_note_bookingId_idx" ON "credit_note"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_financialYear_sequence_key" ON "credit_note"("financialYear", "sequence");

-- CreateIndex
CREATE INDEX "credit_note_line_creditNoteId_idx" ON "credit_note_line"("creditNoteId");

-- CreateIndex
CREATE INDEX "credit_note_line_invoiceLineId_idx" ON "credit_note_line"("invoiceLineId");

-- CreateIndex
CREATE INDEX "document_preset_documentType_ownerId_idx" ON "document_preset"("documentType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "generated_document_storageKey_key" ON "generated_document"("storageKey");

-- CreateIndex
CREATE INDEX "generated_document_bookingId_documentType_createdAt_idx" ON "generated_document"("bookingId", "documentType", "createdAt");

-- CreateIndex
CREATE INDEX "lead_customerId_idx" ON "lead"("customerId");

-- AddForeignKey
ALTER TABLE "package" ADD CONSTRAINT "package_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_document" ADD CONSTRAINT "customer_document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_document" ADD CONSTRAINT "customer_document_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "bride_groom_party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_composition" ADD CONSTRAINT "hall_composition_compositeHallId_fkey" FOREIGN KEY ("compositeHallId") REFERENCES "hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hall_composition" ADD CONSTRAINT "hall_composition_memberHallId_fkey" FOREIGN KEY ("memberHallId") REFERENCES "hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_definition" ADD CONSTRAINT "slot_definition_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "hall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_item" ADD CONSTRAINT "service_item_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_package" ADD CONSTRAINT "menu_package_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_package" ADD CONSTRAINT "menu_package_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_acceptedQuotationId_fkey" FOREIGN KEY ("acceptedQuotationId") REFERENCES "quotation_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sub_event" ADD CONSTRAINT "booking_sub_event_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sub_event" ADD CONSTRAINT "booking_sub_event_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sub_event" ADD CONSTRAINT "booking_sub_event_slotDefinitionId_fkey" FOREIGN KEY ("slotDefinitionId") REFERENCES "slot_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sub_event" ADD CONSTRAINT "booking_sub_event_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_reservation" ADD CONSTRAINT "slot_reservation_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "booking_sub_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_occupancy" ADD CONSTRAINT "slot_occupancy_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "slot_reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_occupancy" ADD CONSTRAINT "slot_occupancy_physicalHallId_fkey" FOREIGN KEY ("physicalHallId") REFERENCES "hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bride_groom_party" ADD CONSTRAINT "bride_groom_party_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_event_menu_selection" ADD CONSTRAINT "sub_event_menu_selection_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "booking_sub_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_event_menu_selection" ADD CONSTRAINT "sub_event_menu_selection_menuPackageId_fkey" FOREIGN KEY ("menuPackageId") REFERENCES "menu_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_version" ADD CONSTRAINT "quotation_version_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line" ADD CONSTRAINT "quotation_line_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "quotation_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "ledger_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_instalment" ADD CONSTRAINT "payment_instalment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_entry" ADD CONSTRAINT "deposit_entry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_event_charge" ADD CONSTRAINT "post_event_charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_event_charge" ADD CONSTRAINT "post_event_charge_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "booking_sub_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_quotationVersionId_fkey" FOREIGN KEY ("quotationVersionId") REFERENCES "quotation_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_postEventChargeId_fkey" FOREIGN KEY ("postEventChargeId") REFERENCES "post_event_charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_line" ADD CONSTRAINT "credit_note_line_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_line" ADD CONSTRAINT "credit_note_line_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "invoice_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_document" ADD CONSTRAINT "generated_document_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
