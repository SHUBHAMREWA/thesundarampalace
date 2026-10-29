-- "Popular wedding dates" homepage section removed (owner request, 28 Oct 2026).
-- Only the homepage block goes; the auspicious dates themselves stay (the
-- date checker still uses them).

DELETE FROM "home_section" WHERE "type" = 'dates';
