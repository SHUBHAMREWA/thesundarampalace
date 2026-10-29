-- About page is now static, hand-written content in the code (owner request,
-- 28 Oct 2026), so its CMS record is removed. Nothing else references it.

DELETE FROM "website_page" WHERE "kind" = 'STANDARD' AND "slug" = 'about';
