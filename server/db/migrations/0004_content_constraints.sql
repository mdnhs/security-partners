ALTER TABLE "media_usages" DROP CONSTRAINT "media_usages_media_id_media_id_fk";
--> statement-breakpoint
DROP INDEX "revisions_entity_idx";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_entity_version_unique" UNIQUE("entity_type","entity_id","version");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_key_unique" UNIQUE("key");--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_not_self" CHECK ("redirects"."from_path" <> "redirects"."to_path");--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_from_path_absolute" CHECK ("redirects"."from_path" like '/%');--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_role" CHECK ("ai_messages"."role" in ('user', 'assistant', 'system', 'tool'));