-- MK parity D2: marketing settings.
-- Tracking: per-channel switches (gtmEnabled, ga4Enabled, metaEnabled).
-- A channel starts on only where tracking was on and its ID was set, so the
-- live site keeps loading exactly what it loaded before. Rows that already
-- have the switches are left alone (safe to re-run); non-objects are skipped.
-- `"x"->'enabled' = 'true'` is false (never NULL, never a cast error) for a
-- missing or odd value, which keeps every switch a boolean.
UPDATE "settings" SET "draft" = "draft" || jsonb_build_object(
  'gtmEnabled', COALESCE("draft"->'enabled' = 'true'::jsonb, false) AND ("draft"->>'gtmId') IS NOT NULL,
  'ga4Enabled', COALESCE("draft"->'enabled' = 'true'::jsonb, false) AND ("draft"->>'ga4Id') IS NOT NULL,
  'metaEnabled', COALESCE("draft"->'enabled' = 'true'::jsonb, false) AND ("draft"->>'metaPixelId') IS NOT NULL)
WHERE "key" = 'tracking' AND jsonb_typeof("draft") = 'object' AND NOT ("draft" ? 'gtmEnabled');
--> statement-breakpoint
UPDATE "settings" SET "published" = "published" || jsonb_build_object(
  'gtmEnabled', COALESCE("published"->'enabled' = 'true'::jsonb, false) AND ("published"->>'gtmId') IS NOT NULL,
  'ga4Enabled', COALESCE("published"->'enabled' = 'true'::jsonb, false) AND ("published"->>'ga4Id') IS NOT NULL,
  'metaEnabled', COALESCE("published"->'enabled' = 'true'::jsonb, false) AND ("published"->>'metaPixelId') IS NOT NULL)
WHERE "key" = 'tracking' AND jsonb_typeof("published") = 'object' AND NOT ("published" ? 'gtmEnabled');
--> statement-breakpoint
UPDATE "revisions" SET "data" = "data" || jsonb_build_object(
  'gtmEnabled', COALESCE("data"->'enabled' = 'true'::jsonb, false) AND ("data"->>'gtmId') IS NOT NULL,
  'ga4Enabled', COALESCE("data"->'enabled' = 'true'::jsonb, false) AND ("data"->>'ga4Id') IS NOT NULL,
  'metaEnabled', COALESCE("data"->'enabled' = 'true'::jsonb, false) AND ("data"->>'metaPixelId') IS NOT NULL)
WHERE "entity_type" = 'settings' AND "entity_id" = 'tracking' AND jsonb_typeof("data") = 'object' AND NOT ("data" ? 'gtmEnabled');
