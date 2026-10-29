-- The venue has no kitchen of its own (partner caterer), so the Kitchen role,
-- its permissions and the kitchen sheet document type are removed.
-- Data only: no tables or columns change. Generated documents are history and
-- stay as they are (no kitchen sheets were stored: kitchen sheets never kept a PDF).
-- The replacement permission `pdf.menu` is added by the reference seed, which
-- grants it to the roles listed in src/lib/permissions/registry.ts.

DELETE FROM "user_role" WHERE "roleId" IN (SELECT "id" FROM "role" WHERE "key" = 'kitchen');
DELETE FROM "role_permission" WHERE "roleId" IN (SELECT "id" FROM "role" WHERE "key" = 'kitchen');
DELETE FROM "role" WHERE "key" = 'kitchen';

DELETE FROM "role_permission" WHERE "permissionKey" IN ('kitchen.read', 'pdf.kitchen_sheet');
DELETE FROM "permission" WHERE "key" IN ('kitchen.read', 'pdf.kitchen_sheet');

DELETE FROM "document_preset" WHERE "documentType" = 'kitchen_sheet';
