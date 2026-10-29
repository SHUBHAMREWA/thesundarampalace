import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { todayIST } from "@/lib/time";
import {
  createBooking,
  createBookingSchema,
} from "@/server/services/bookings";
import {
  assignVendor,
  assignmentSchema,
  createExpense,
  deleteExpense,
  expenseListQuerySchema,
  expenseSchema,
  listExpenses,
  listVendors,
  removeVendorAssignment,
  saveVendor,
  updateExpense,
  vendorSchema,
} from "@/server/services/operations";
import { presetRange } from "@/lib/reports/range";
import { simpleReports } from "@/server/services/reports";
import {
  createTask,
  listTasks,
  setTaskStatus,
  taskListQuerySchema,
  taskSchema,
} from "@/server/services/tasks";

import { describeDb } from "./helpers";
import { actorFor, makeCustomer, setupPhase3, type Fixture } from "./phase3-fixtures";

let fx: Fixture;
const P = "ops";

const manager = () => actorFor(fx.users.manager, "manager");
const sales = () => actorFor(fx.users.sales, "sales");
const accounts = () => actorFor(fx.users.accounts, "accounts");
const operations = () => actorFor(fx.users.operations, "operations");

describeDb("Phase 4: Operations, tasks, vendors, expenses, and reports", () => {
  beforeAll(async () => {
    fx = await setupPhase3(P);
  });
  afterAll(() => db.$disconnect());

  describe("Tasks & Templates", () => {
    it("creates, scopes, assigns, and transitions tasks", async () => {
      // Operations user can create task for self
      const taskInput = taskSchema.parse({
        title: "Check audio system",
        description: "Ensure cordless mics are charged",
        priority: "HIGH",
      });
      const task1 = await createTask(operations(), taskInput);
      expect(task1.id).toBeDefined();
      expect(task1.assigneeId).toBe(fx.users.operations);
      expect(task1.status).toBe("OPEN");

      // Sales user can only see their own tasks
      const salesQuery = taskListQuerySchema.parse({ view: "mine" });
      const salesTasks = await listTasks(sales(), salesQuery);
      expect(salesTasks.rows.some((r) => r.id === task1.id)).toBe(false);

      // Operations user sees it in 'mine'
      const opsQuery = taskListQuerySchema.parse({ view: "mine" });
      const opsTasks = await listTasks(operations(), opsQuery);
      expect(opsTasks.rows.some((r) => r.id === task1.id)).toBe(true);

      // Operations updates status: OPEN -> IN_PROGRESS -> DONE
      await setTaskStatus(operations(), task1.id, "IN_PROGRESS");
      let updated = await db.task.findUniqueOrThrow({ where: { id: task1.id } });
      expect(updated.status).toBe("IN_PROGRESS");

      await setTaskStatus(operations(), task1.id, "DONE");
      updated = await db.task.findUniqueOrThrow({ where: { id: task1.id } });
      expect(updated.status).toBe("DONE");
      expect(updated.completedAt).not.toBeNull();
      expect(updated.completedById).toBe(fx.users.operations);

      // Manager has tasks.manage and can assign task to someone else
      const managerTask = await createTask(
        manager(),
        taskSchema.parse({
          title: "Setup stage lighting",
          assigneeId: fx.users.operations,
          priority: "URGENT",
        }),
      );
      expect(managerTask.assigneeId).toBe(fx.users.operations);
      expect(managerTask.createdById).toBe(fx.users.manager);
    });
  });

  describe("Vendors & Assignments", () => {
    it("creates vendors and assigns them to bookings", async () => {
      // Manager creates vendor
      const vendor = await saveVendor(
        manager(),
        null,
        vendorSchema.parse({
          name: "Royal Florists",
          categoryKey: "decor",
          contactName: "Vikram Sharma",
          phone: "9876543210",
          email: "vikram@florists.test",
          partner: "true",
          notes: "Preferred mandap decorator",
          active: "true",
        }),
      );
      expect(vendor.id).toBeDefined();
      expect(vendor.partner).toBe(true);

      // List vendors
      const vendors = await listVendors(manager(), { q: "Royal" });
      expect(vendors.some((v) => v.id === vendor.id)).toBe(true);

      // Assign vendor to a booking
      const customer = await makeCustomer(P);
      const booking = await createBooking(
        sales(),
        createBookingSchema.parse({
          customerId: customer.id,
          mainEventName: "Vendor Test Booking",
          mainEventTypeKey: "wedding",
          initialStatus: "TENTATIVE",
        }),
      );

      await assignVendor(
        manager(),
        booking.id,
        assignmentSchema.parse({
          vendorId: vendor.id,
          service: "Mandap and entrance floral decor",
          notes: "Pastel theme requested",
        }),
      );

      const assignments = await db.vendorAssignment.findMany({ where: { bookingId: booking.id } });
      expect(assignments.length).toBe(1);
      expect(assignments[0].service).toBe("Mandap and entrance floral decor");

      // Remove assignment
      await removeVendorAssignment(manager(), assignments[0].id);
      const afterRemoval = await db.vendorAssignment.findMany({ where: { bookingId: booking.id } });
      expect(afterRemoval.length).toBe(0);
    });
  });

  describe("Expenses Management", () => {
    it("records, updates, filters, and deletes expenses with audit logging", async () => {
      const today = todayIST();
      const expense = await createExpense(
        accounts(),
        expenseSchema.parse({
          description: "Generator diesel fuel",
          categoryKey: "utilities",
          amount: "12500.00",
          incurredOn: today,
          paymentStatus: "PAID",
          notes: "300 Litres for main event backup",
        }),
      );
      expect(expense.id).toBeDefined();

      // List expenses
      const query = expenseListQuerySchema.parse({ from: today, to: today });
      const list = await listExpenses(accounts(), query);
      expect(list.total).toBeGreaterThanOrEqual(1);
      expect(list.rows.some((r) => r.id === expense.id)).toBe(true);

      // Update expense
      await updateExpense(
        accounts(),
        expense.id,
        expenseSchema.parse({
          description: "Generator diesel fuel (revised)",
          categoryKey: "utilities",
          amount: "13000.00",
          incurredOn: today,
          paymentStatus: "PAID",
          notes: "Adjusted for delivery charges",
        }),
      );

      const updated = await db.expense.findUniqueOrThrow({ where: { id: expense.id } });
      expect(updated.description).toBe("Generator diesel fuel (revised)");
      expect(updated.amount.toFixed(2)).toBe("13000.00");

      // Delete expense (soft delete + audit log)
      await deleteExpense(accounts(), expense.id, "Entered under wrong category");
      const deleted = await db.expense.findUniqueOrThrow({ where: { id: expense.id } });
      expect(deleted.deletedAt).not.toBeNull();

      // Verify audit record exists
      const audit = await db.auditLog.findFirst({
        where: { entityType: "expense", entityId: expense.id, action: "expense.deleted" },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("Simple reports", () => {
    it("shows each role only its pie charts", async () => {
      expect((await simpleReports(sales(), presetRange("this-month"))).map((r) => r.key)).toEqual(["sources", "outcomes", "events"]);
      expect((await simpleReports(accounts(), presetRange("this-month"))).map((r) => r.key)).toEqual(["payments"]);
    });
  });
});
