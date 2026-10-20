-- Phase 7: contact form feedback copy (settings.sections.contact.form).
-- Adds missing keys only; values the owner already edited win (right side of ||).
UPDATE "settings"
SET
  "draft" = jsonb_set("draft", '{form}', '{"sendingLabel":"Sending…","successMessage":"Thank you, your message has been sent. We will be in touch shortly.","errorMessage":"Sorry, your message could not be sent. Please try again or call us.","rateLimitedMessage":"You have sent several messages in a short time. Please wait a few minutes and try again."}'::jsonb || ("draft" -> 'form')),
  "published" = CASE
    WHEN jsonb_typeof("published" -> 'form') = 'object'
    THEN jsonb_set("published", '{form}', '{"sendingLabel":"Sending…","successMessage":"Thank you, your message has been sent. We will be in touch shortly.","errorMessage":"Sorry, your message could not be sent. Please try again or call us.","rateLimitedMessage":"You have sent several messages in a short time. Please wait a few minutes and try again."}'::jsonb || ("published" -> 'form'))
    ELSE "published"
  END
WHERE "key" = 'sections.contact' AND jsonb_typeof("draft" -> 'form') = 'object';
--> statement-breakpoint
UPDATE "revisions"
SET "data" = jsonb_set("data", '{form}', '{"sendingLabel":"Sending…","successMessage":"Thank you, your message has been sent. We will be in touch shortly.","errorMessage":"Sorry, your message could not be sent. Please try again or call us.","rateLimitedMessage":"You have sent several messages in a short time. Please wait a few minutes and try again."}'::jsonb || ("data" -> 'form'))
WHERE "entity_type" = 'settings' AND "entity_id" = 'sections.contact' AND jsonb_typeof("data" -> 'form') = 'object';
