-- AI assistant settings (MK parity): adds the new fields to a saved
-- integrations.ai row. Existing keys win (the stored apiKey ciphertext and
-- any value already present are kept); no row is created. Integrations are
-- not versioned, so no revision is written.
UPDATE "settings"
SET "draft" = '{"baseUrl":"","extraInstructions":"","maxOutputTokens":1024,"shareEnquiryDetails":{"enabled":false,"acknowledgedBy":null,"acknowledgedAt":null}}'::jsonb || "draft"
WHERE "key" = 'integrations.ai' AND jsonb_typeof("draft") = 'object';
