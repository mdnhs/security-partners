CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"source_path" text DEFAULT '/' NOT NULL,
	"consent_text" text DEFAULT '' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscribers_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "newsletter_email_lower" CHECK ("newsletter_subscribers"."email" = lower("newsletter_subscribers"."email")),
	CONSTRAINT "newsletter_status" CHECK ("newsletter_subscribers"."status" in ('pending', 'confirmed', 'unsubscribed'))
);
--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_status_created_at_idx" ON "newsletter_subscribers" USING btree ("status","created_at");
--> statement-breakpoint
INSERT INTO "settings" ("key", "draft", "published") VALUES ('newsletter', '{"placement":"off","doubleOptIn":true,"pendingDays":30,"eyebrow":"Newsletter","title":"Security insights in your inbox","subtitle":"One short email a month. Unsubscribe any time.","emailLabel":"Email address","placeholder":"you@company.ie","button":"Subscribe","success":"Check your inbox to confirm your subscription.","errors":{"email":"Enter a valid email address.","rateLimited":"Too many attempts. Please try again in a few minutes.","generic":"Something went wrong. Please try again."},"confirmationEmail":{"subject":"Confirm your subscription","body":"Please confirm that you would like to receive the Security Partners newsletter. If you did not ask for this, ignore this email and you will not hear from us again."},"pages":{"confirm":{"title":"Confirm your subscription","body":"Press the button below to confirm that you would like to receive our newsletter.","button":"Confirm subscription"},"confirmed":{"title":"You''re subscribed","body":"Thanks for confirming. Our next newsletter will arrive in your inbox."},"invalid":{"title":"This link is no longer valid","body":"The confirmation link has expired or was already used. Please subscribe again."},"unsubscribe":{"title":"Unsubscribe","body":"Press the button below to stop receiving our newsletter.","button":"Unsubscribe"},"unsubscribed":{"title":"You''re unsubscribed","body":"You will not receive any more newsletters from us."}}}'::jsonb, '{"placement":"off","doubleOptIn":true,"pendingDays":30,"eyebrow":"Newsletter","title":"Security insights in your inbox","subtitle":"One short email a month. Unsubscribe any time.","emailLabel":"Email address","placeholder":"you@company.ie","button":"Subscribe","success":"Check your inbox to confirm your subscription.","errors":{"email":"Enter a valid email address.","rateLimited":"Too many attempts. Please try again in a few minutes.","generic":"Something went wrong. Please try again."},"confirmationEmail":{"subject":"Confirm your subscription","body":"Please confirm that you would like to receive the Security Partners newsletter. If you did not ask for this, ignore this email and you will not hear from us again."},"pages":{"confirm":{"title":"Confirm your subscription","body":"Press the button below to confirm that you would like to receive our newsletter.","button":"Confirm subscription"},"confirmed":{"title":"You''re subscribed","body":"Thanks for confirming. Our next newsletter will arrive in your inbox."},"invalid":{"title":"This link is no longer valid","body":"The confirmation link has expired or was already used. Please subscribe again."},"unsubscribe":{"title":"Unsubscribe","body":"Press the button below to stop receiving our newsletter.","button":"Unsubscribe"},"unsubscribed":{"title":"You''re unsubscribed","body":"You will not receive any more newsletters from us."}}}'::jsonb) ON CONFLICT ("key") DO NOTHING;