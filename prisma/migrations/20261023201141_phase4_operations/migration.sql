-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('UNPAID', 'PARTLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "DataRequestKind" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "task_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventTypeKeys" JSONB NOT NULL DEFAULT '[]',
    "autoOnConfirm" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_item" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "assigneeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_template_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "dueAt" TIMESTAMPTZ(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "bookingId" TEXT,
    "subEventId" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "templateId" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "completedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "partner" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_assignment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "subEventId" TEXT,
    "service" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "categoryKey" TEXT NOT NULL,
    "vendorId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incurredOn" DATE NOT NULL,
    "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "deletedReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_request" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" "DataRequestKind" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'OPEN',
    "details" TEXT NOT NULL,
    "receivedOn" DATE NOT NULL,
    "dueOn" DATE NOT NULL,
    "resolution" TEXT,
    "handledById" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "data_subject_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_template_item_templateId_sortOrder_idx" ON "task_template_item"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "task_assigneeId_status_dueAt_idx" ON "task"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "task_bookingId_idx" ON "task"("bookingId");

-- CreateIndex
CREATE INDEX "task_status_dueAt_idx" ON "task"("status", "dueAt");

-- CreateIndex
CREATE INDEX "vendor_categoryKey_active_idx" ON "vendor"("categoryKey", "active");

-- CreateIndex
CREATE INDEX "vendor_assignment_bookingId_idx" ON "vendor_assignment"("bookingId");

-- CreateIndex
CREATE INDEX "vendor_assignment_vendorId_idx" ON "vendor_assignment"("vendorId");

-- CreateIndex
CREATE INDEX "expense_bookingId_idx" ON "expense"("bookingId");

-- CreateIndex
CREATE INDEX "expense_incurredOn_idx" ON "expense"("incurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "data_subject_request_reference_key" ON "data_subject_request"("reference");

-- CreateIndex
CREATE INDEX "data_subject_request_status_dueOn_idx" ON "data_subject_request"("status", "dueOn");

-- CreateIndex
CREATE INDEX "data_subject_request_subjectType_subjectId_idx" ON "data_subject_request"("subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "task_template_item" ADD CONSTRAINT "task_template_item_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_assignment" ADD CONSTRAINT "vendor_assignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_assignment" ADD CONSTRAINT "vendor_assignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
