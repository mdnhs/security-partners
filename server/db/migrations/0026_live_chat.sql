CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"needs_human" boolean DEFAULT false NOT NULL,
	"assigned_to" uuid,
	"visitor_name" text NOT NULL,
	"visitor_email" text,
	"consent_at" timestamp with time zone NOT NULL,
	"source_path" text,
	"ai_reply_count" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"ai_lease_until" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_visitor_message_at" timestamp with time zone,
	"last_reply_at" timestamp with time zone,
	"staff_read_at" timestamp with time zone,
	"no_reply_alerted_at" timestamp with time zone,
	"needs_human_alerted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "chat_conversations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "chat_conversations_status_check" CHECK ("chat_conversations"."status" in ('open','closed')),
	CONSTRAINT "chat_conversations_source_path_check" CHECK ("chat_conversations"."source_path" is null or char_length("chat_conversations"."source_path") <= 200)
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"sender_name" text,
	"body" text NOT NULL,
	"notice_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_sender_check" CHECK ("chat_messages"."sender" in ('visitor','staff','ai','system')),
	CONSTRAINT "chat_messages_body_check" CHECK (char_length("chat_messages"."body") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "chat_presence" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_presence" ADD CONSTRAINT "chat_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversations_status_last_idx" ON "chat_conversations" USING btree ("status","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_conversations_email_idx" ON "chat_conversations" USING btree (lower("visitor_email"));--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_notice_once_idx" ON "chat_messages" USING btree ("conversation_id","notice_kind") WHERE "chat_messages"."notice_kind" is not null;--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id","id");--> statement-breakpoint
INSERT INTO "settings" ("key", "draft", "published") VALUES ('chat', '{"enabled":false,"teamName":"the Security Partners team","bot":{"enabled":false,"name":"Assistant","extraInstructions":"","maxAiReplies":20},"hint":{"title":"How can we help?","subtitle":"Questions about security or a quote?","presets":[{"label":"Can I get a quote?","message":"Can I get a quote?"},{"label":"Which areas do you cover?","message":"Which areas do you cover?"},{"label":"Do you offer mobile patrols?","message":"Do you offer mobile patrols?"},{"label":"Is your team licensed and insured?","message":"Is your team licensed and insured?"},{"label":"How do I arrange security cover?","message":"How do I arrange security cover?"}]},"copy":{"launcherOpen":"Open chat","launcherOpenUnread":"Open chat, new message","close":"Close chat","hintGroup":"Chat options","hintDismiss":"Hide this message","title":"Chat with us","welcome":"Hi, how can we help?","statusReconnecting":"Reconnecting…","statusAgent":"Chatting with {agent}","statusBot":"{botName} (AI) · {team} can join","statusOnline":"We''re online","statusOffline":"We''ll reply as soon as we can","conversation":"Conversation","aiCaption":"{botName} · AI","typing":"{botName} is typing…","messageLabel":"Your message","messagePlaceholder":"Write a message","send":"Send message","startNew":"Start a new chat","connecting":"One moment, connecting…","consentBot":"Messages are read by an AI assistant and {team}.","consentTeam":"Messages are read by {team}.","privacyLabel":"Privacy notice","privacyHref":"/privacy","offlineNote":"No one is online right now. Leave your email and {team} will reply.","emailPlaceholder":"name@example.com","emailSave":"Save email","emailDismiss":"No thanks","emailError":"Please check that email address and try again.","noticeOffline":"You seem to be offline. We''ll keep trying.","noticeRate":"You''re sending messages quickly. Please wait a moment.","noticeEnded":"This chat has ended.","errorTooLong":"Please write a shorter message.","errorStart":"We couldn''t start the chat. Please try again.","errorGeneric":"Something went wrong. Please try once more."},"notices":{"handoff":"I''ve asked {team} to join. They''ll reply here, or by email if you leave one.","limit":"I''ve passed this chat to {team} so a person can help from here.","failed":"The assistant is unavailable right now. We''ve let {team} know, and they''ll reply soon.","joined":"{name} joined the chat.","back":"The assistant is back on this chat.","ended":"This chat has ended."},"alerts":{"includeMessage":true},"retentionMonths":12}'::jsonb, '{"enabled":false,"teamName":"the Security Partners team","bot":{"enabled":false,"name":"Assistant","extraInstructions":"","maxAiReplies":20},"hint":{"title":"How can we help?","subtitle":"Questions about security or a quote?","presets":[{"label":"Can I get a quote?","message":"Can I get a quote?"},{"label":"Which areas do you cover?","message":"Which areas do you cover?"},{"label":"Do you offer mobile patrols?","message":"Do you offer mobile patrols?"},{"label":"Is your team licensed and insured?","message":"Is your team licensed and insured?"},{"label":"How do I arrange security cover?","message":"How do I arrange security cover?"}]},"copy":{"launcherOpen":"Open chat","launcherOpenUnread":"Open chat, new message","close":"Close chat","hintGroup":"Chat options","hintDismiss":"Hide this message","title":"Chat with us","welcome":"Hi, how can we help?","statusReconnecting":"Reconnecting…","statusAgent":"Chatting with {agent}","statusBot":"{botName} (AI) · {team} can join","statusOnline":"We''re online","statusOffline":"We''ll reply as soon as we can","conversation":"Conversation","aiCaption":"{botName} · AI","typing":"{botName} is typing…","messageLabel":"Your message","messagePlaceholder":"Write a message","send":"Send message","startNew":"Start a new chat","connecting":"One moment, connecting…","consentBot":"Messages are read by an AI assistant and {team}.","consentTeam":"Messages are read by {team}.","privacyLabel":"Privacy notice","privacyHref":"/privacy","offlineNote":"No one is online right now. Leave your email and {team} will reply.","emailPlaceholder":"name@example.com","emailSave":"Save email","emailDismiss":"No thanks","emailError":"Please check that email address and try again.","noticeOffline":"You seem to be offline. We''ll keep trying.","noticeRate":"You''re sending messages quickly. Please wait a moment.","noticeEnded":"This chat has ended.","errorTooLong":"Please write a shorter message.","errorStart":"We couldn''t start the chat. Please try again.","errorGeneric":"Something went wrong. Please try once more."},"notices":{"handoff":"I''ve asked {team} to join. They''ll reply here, or by email if you leave one.","limit":"I''ve passed this chat to {team} so a person can help from here.","failed":"The assistant is unavailable right now. We''ve let {team} know, and they''ll reply soon.","joined":"{name} joined the chat.","back":"The assistant is back on this chat.","ended":"This chat has ended."},"alerts":{"includeMessage":true},"retentionMonths":12}'::jsonb) ON CONFLICT ("key") DO NOTHING;
