CREATE TABLE "builder_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builder_pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "builder_pages_slug_format" CHECK ("builder_pages"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("builder_pages"."slug") <= 60)
);
--> statement-breakpoint
ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_pages" ADD CONSTRAINT "builder_pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;