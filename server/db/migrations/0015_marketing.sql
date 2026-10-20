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
--> statement-breakpoint
-- Consent (D2.2): version 1 and a 6-month re-consent interval, matching
-- the cookies already stored (version 1, 180 days). Existing values win
-- (the right side of || overrides), so it is safe to re-run.
UPDATE "settings" SET "draft" = '{"version":1,"reconsentMonths":6}'::jsonb || "draft"
WHERE "key" = 'consent' AND jsonb_typeof("draft") = 'object';
--> statement-breakpoint
UPDATE "settings" SET "published" = '{"version":1,"reconsentMonths":6}'::jsonb || "published"
WHERE "key" = 'consent' AND jsonb_typeof("published") = 'object';
--> statement-breakpoint
UPDATE "revisions" SET "data" = '{"version":1,"reconsentMonths":6}'::jsonb || "data"
WHERE "entity_type" = 'settings' AND "entity_id" = 'consent' AND jsonb_typeof("data") = 'object';
--> statement-breakpoint
-- Custom code (D2.3): { headHtml, bodyEndHtml } becomes structured snippets.
-- Each non-blank block becomes a necessary, all-routes, enabled snippet
-- ("Head code" / "Body code"): it ran without consent before, so it keeps
-- doing so. Same result as convertLegacyCustomCode (lib/analytics/snippets.ts).
-- Snippet ids are gen_random_uuid() (v4) as text. The settings row's draft
-- and published share their ids, so an unchanged value stays unchanged.
-- Only values that still have headHtml are converted (safe to re-run).
UPDATE "settings" SET
  "draft" = CASE WHEN jsonb_typeof("draft") = 'object' AND "draft" ? 'headHtml' THEN jsonb_build_object(
    'disabled', false, 'allowedHosts', '[]'::jsonb, 'snippets',
    (CASE WHEN COALESCE("draft"->>'headHtml', '') ~ '\S' THEN jsonb_build_array(jsonb_build_object(
      'id', "ids"."head", 'name', 'Head code', 'placement', 'head', 'src', '', 'html', "draft"->>'headHtml',
      'category', 'necessary', 'routes', '[]'::jsonb, 'enabled', true)) ELSE '[]'::jsonb END)
    || (CASE WHEN COALESCE("draft"->>'bodyEndHtml', '') ~ '\S' THEN jsonb_build_array(jsonb_build_object(
      'id', "ids"."body", 'name', 'Body code', 'placement', 'body', 'src', '', 'html', "draft"->>'bodyEndHtml',
      'category', 'necessary', 'routes', '[]'::jsonb, 'enabled', true)) ELSE '[]'::jsonb END))
    ELSE "draft" END,
  "published" = CASE WHEN jsonb_typeof("published") = 'object' AND "published" ? 'headHtml' THEN jsonb_build_object(
    'disabled', false, 'allowedHosts', '[]'::jsonb, 'snippets',
    (CASE WHEN COALESCE("published"->>'headHtml', '') ~ '\S' THEN jsonb_build_array(jsonb_build_object(
      'id', "ids"."head", 'name', 'Head code', 'placement', 'head', 'src', '', 'html', "published"->>'headHtml',
      'category', 'necessary', 'routes', '[]'::jsonb, 'enabled', true)) ELSE '[]'::jsonb END)
    || (CASE WHEN COALESCE("published"->>'bodyEndHtml', '') ~ '\S' THEN jsonb_build_array(jsonb_build_object(
      'id', "ids"."body", 'name', 'Body code', 'placement', 'body', 'src', '', 'html', "published"->>'bodyEndHtml',
      'category', 'necessary', 'routes', '[]'::jsonb, 'enabled', true)) ELSE '[]'::jsonb END))
    ELSE "published" END
FROM (SELECT gen_random_uuid()::text AS "head", gen_random_uuid()::text AS "body") AS "ids"
WHERE "settings"."key" = 'customCode';
--> statement-breakpoint
UPDATE "revisions" SET "data" = jsonb_build_object(
    'disabled', false, 'allowedHosts', '[]'::jsonb, 'snippets',
    (CASE WHEN COALESCE("data"->>'headHtml', '') ~ '\S' THEN jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'name', 'Head code', 'placement', 'head', 'src', '', 'html', "data"->>'headHtml',
      'category', 'necessary', 'routes', '[]'::jsonb, 'enabled', true)) ELSE '[]'::jsonb END)
    || (CASE WHEN COALESCE("data"->>'bodyEndHtml', '') ~ '\S' THEN jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'name', 'Body code', 'placement', 'body', 'src', '', 'html', "data"->>'bodyEndHtml',
      'category', 'necessary', 'routes', '[]'::jsonb, 'enabled', true)) ELSE '[]'::jsonb END))
WHERE "entity_type" = 'settings' AND "entity_id" = 'customCode' AND jsonb_typeof("data") = 'object' AND "data" ? 'headHtml';
