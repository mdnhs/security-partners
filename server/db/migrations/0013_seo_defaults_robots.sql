-- MK D1.6: settings.seo.defaults gains `robots` (site-wide index/noindex) and
-- `verification` (search console tokens). Adds missing keys only; values
-- already present win (right side of ||). Draft, published and revisions.
UPDATE "settings"
SET "draft" = '{"robots":"index","verification":{"google":"","bing":""}}'::jsonb || "draft"
WHERE "key" = 'seo.defaults' AND jsonb_typeof("draft") = 'object';
--> statement-breakpoint
UPDATE "settings"
SET "published" = '{"robots":"index","verification":{"google":"","bing":""}}'::jsonb || "published"
WHERE "key" = 'seo.defaults' AND jsonb_typeof("published") = 'object';
--> statement-breakpoint
UPDATE "revisions"
SET "data" = '{"robots":"index","verification":{"google":"","bing":""}}'::jsonb || "data"
WHERE "entity_type" = 'settings' AND "entity_id" = 'seo.defaults' AND jsonb_typeof("data") = 'object';
