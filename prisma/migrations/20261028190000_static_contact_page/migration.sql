-- Contact page wording is now static code (owner request, 28 Oct 2026), so its
-- CMS record is removed. Contact details stay in Settings.

DELETE FROM "website_page" WHERE "kind" = 'STANDARD' AND "slug" = 'contact';
