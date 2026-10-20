ALTER TABLE "media" ADD COLUMN "original_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "media" SET "original_name" = regexp_replace("key", '^.*/', '') WHERE "original_name" = '';
