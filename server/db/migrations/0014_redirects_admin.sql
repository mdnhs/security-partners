ALTER TABLE "redirects" DROP CONSTRAINT "redirects_code";--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "last_hit_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_source" CHECK ("redirects"."source" in ('manual', 'auto', 'import'));--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_code" CHECK ("redirects"."code" in (301, 302, 307, 308));