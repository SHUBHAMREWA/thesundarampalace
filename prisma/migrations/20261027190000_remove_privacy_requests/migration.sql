-- Privacy requests screen removed (owner request, 27 Oct 2026). Data only:
-- the permission goes; the data_subject_request table and its rows stay
-- untouched as history (no data is deleted).

DELETE FROM "role_permission" WHERE "permissionKey" = 'privacy.requests';
DELETE FROM "permission" WHERE "key" = 'privacy.requests';
