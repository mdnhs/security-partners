DROP TABLE "newsletter_subscribers" CASCADE;
--> statement-breakpoint
-- Newsletter removed 2026-10-20 at owner request: its settings row, the
-- settings revisions, the purge job and the rate-limit buckets go too.
DELETE FROM "settings" WHERE "key" LIKE 'newsletter%';
--> statement-breakpoint
DELETE FROM "revisions" WHERE "entity_type" = 'settings' AND "entity_id" LIKE 'newsletter%';
--> statement-breakpoint
DELETE FROM "jobs" WHERE "key" = 'purge-newsletter' OR "name" = 'purge-newsletter';
--> statement-breakpoint
DELETE FROM "public_rate_limits" WHERE "key" ~ '^newsletter(-resend|-token)?:';
--> statement-breakpoint
-- Builder pages: the "newsletter" block type no longer exists. Strip it from
-- drafts, published documents and revisions so they still validate. Changed
-- pages bump their version (an open editor reloads instead of overwriting).
UPDATE "builder_pages" SET
  "draft" = jsonb_set("draft", '{blocks}', COALESCE((
    SELECT jsonb_agg(e.block ORDER BY e.i)
    FROM jsonb_array_elements("draft" -> 'blocks') WITH ORDINALITY AS e(block, i)
    WHERE e.block ->> 'type' IS DISTINCT FROM 'newsletter'
  ), '[]'::jsonb)),
  "version" = "version" + 1
WHERE "draft" -> 'blocks' @> '[{"type":"newsletter"}]'::jsonb;
--> statement-breakpoint
UPDATE "builder_pages" SET
  "published" = jsonb_set("published", '{blocks}', COALESCE((
    SELECT jsonb_agg(e.block ORDER BY e.i)
    FROM jsonb_array_elements("published" -> 'blocks') WITH ORDINALITY AS e(block, i)
    WHERE e.block ->> 'type' IS DISTINCT FROM 'newsletter'
  ), '[]'::jsonb)),
  "version" = "version" + 1
WHERE "published" -> 'blocks' @> '[{"type":"newsletter"}]'::jsonb;
--> statement-breakpoint
-- A published page needs at least one block: one that showed only the
-- newsletter goes back to draft.
UPDATE "builder_pages" SET
  "published" = NULL,
  "status" = 'draft',
  "published_at" = NULL
WHERE "published" IS NOT NULL AND jsonb_array_length("published" -> 'blocks') = 0;
--> statement-breakpoint
UPDATE "revisions" SET
  "data" = jsonb_set("data", '{blocks}', COALESCE((
    SELECT jsonb_agg(e.block ORDER BY e.i)
    FROM jsonb_array_elements("data" -> 'blocks') WITH ORDINALITY AS e(block, i)
    WHERE e.block ->> 'type' IS DISTINCT FROM 'newsletter'
  ), '[]'::jsonb))
WHERE "entity_type" = 'builder-page' AND "data" -> 'blocks' @> '[{"type":"newsletter"}]'::jsonb;
