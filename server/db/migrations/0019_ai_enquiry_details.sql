ALTER TABLE "ai_messages" ADD COLUMN "enquiry_details" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Before this column, lead screens sent enquiry details whatever the owner's
-- switch said: every earlier message counts as holding them (C9 review I1).
UPDATE "ai_messages" SET "enquiry_details" = true;
