-- Careers: "Send Us Your CV" opens the talent pool form (/careers/apply)
-- instead of an email, the retention copy reads Settings › Careers
-- ({months}, {keepMonths}), and settings.careers gains keepOnFileMonths.
-- Only copy still as 0022 wrote it is changed; re-running is a no-op.
UPDATE "pages" SET "draft" = jsonb_set("draft", '{cta,primary,href}', '"/careers/apply"'::jsonb)
WHERE "key" = 'careers' AND "draft" #>> '{cta,primary,href}' = 'mailto:HR@securitypartnersltd.com';
--> statement-breakpoint
UPDATE "pages" SET "draft" = jsonb_set("draft", '{apply,consents,2}', '"Keep my details on file for {keepMonths} months and contact me about future roles."'::jsonb)
WHERE "key" = 'careers' AND "draft" #>> '{apply,consents,2}' = 'Keep my details on file for 12 months and contact me about future roles.';
--> statement-breakpoint
UPDATE "pages" SET "draft" = jsonb_set("draft", '{apply,sidebar,dataCopy}', '"We only use your details for recruitment. Unsuccessful applications are deleted after {months} months unless you ask us to keep them, in line with GDPR."'::jsonb)
WHERE "key" = 'careers' AND "draft" #>> '{apply,sidebar,dataCopy}' = 'We only use your details for recruitment. Unsuccessful applications are deleted after 12 months unless you ask us to keep them, in line with GDPR.';
--> statement-breakpoint
UPDATE "pages" SET "published" = jsonb_set("published", '{cta,primary,href}', '"/careers/apply"'::jsonb)
WHERE "key" = 'careers' AND "published" #>> '{cta,primary,href}' = 'mailto:HR@securitypartnersltd.com';
--> statement-breakpoint
UPDATE "pages" SET "published" = jsonb_set("published", '{apply,consents,2}', '"Keep my details on file for {keepMonths} months and contact me about future roles."'::jsonb)
WHERE "key" = 'careers' AND "published" #>> '{apply,consents,2}' = 'Keep my details on file for 12 months and contact me about future roles.';
--> statement-breakpoint
UPDATE "pages" SET "published" = jsonb_set("published", '{apply,sidebar,dataCopy}', '"We only use your details for recruitment. Unsuccessful applications are deleted after {months} months unless you ask us to keep them, in line with GDPR."'::jsonb)
WHERE "key" = 'careers' AND "published" #>> '{apply,sidebar,dataCopy}' = 'We only use your details for recruitment. Unsuccessful applications are deleted after 12 months unless you ask us to keep them, in line with GDPR.';
--> statement-breakpoint
UPDATE "settings" SET "draft" = "draft" || '{"keepOnFileMonths": 24}'::jsonb
WHERE "key" = 'careers' AND jsonb_typeof("draft") = 'object' AND NOT ("draft" ? 'keepOnFileMonths');
--> statement-breakpoint
UPDATE "settings" SET "published" = "published" || '{"keepOnFileMonths": 24}'::jsonb
WHERE "key" = 'careers' AND jsonb_typeof("published") = 'object' AND NOT ("published" ? 'keepOnFileMonths');
