ALTER TABLE "media" ADD COLUMN "is_decorative" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "caption" text DEFAULT '' NOT NULL;