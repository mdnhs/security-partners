-- Phase 8: settings.consent gains manageLabel (the "Cookie settings" button).
-- Adds the key where it is missing; an existing value wins (right side of ||).
UPDATE "settings"
SET "draft" = '{"manageLabel":"Cookie settings"}'::jsonb || "draft"
WHERE "key" = 'consent' AND jsonb_typeof("draft") = 'object';
--> statement-breakpoint
UPDATE "settings"
SET "published" = '{"manageLabel":"Cookie settings"}'::jsonb || "published"
WHERE "key" = 'consent' AND jsonb_typeof("published") = 'object';
--> statement-breakpoint
UPDATE "revisions"
SET "data" = '{"manageLabel":"Cookie settings"}'::jsonb || "data"
WHERE "entity_type" = 'settings' AND "entity_id" = 'consent' AND jsonb_typeof("data") = 'object';
