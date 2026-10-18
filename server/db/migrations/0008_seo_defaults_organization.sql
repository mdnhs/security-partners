-- Phase 8: settings.seo.defaults gains `organization` (site-wide JSON-LD).
-- Adds missing keys only; values already present win (right side of ||).
UPDATE "settings"
SET
  "draft" = jsonb_set(
    "draft",
    '{organization}',
    '{"type":"LocalBusiness","streetAddress":"Derryguile","addressLocality":"Mountmellick","addressRegion":"Co. Laois","postalCode":"R32 YX49","addressCountry":"IE","areaServed":"Ireland","sameAs":[]}'::jsonb
      || CASE WHEN jsonb_typeof("draft" -> 'organization') = 'object' THEN "draft" -> 'organization' ELSE '{}'::jsonb END
  ),
  "published" = CASE
    WHEN jsonb_typeof("published") = 'object'
    THEN jsonb_set(
      "published",
      '{organization}',
      '{"type":"LocalBusiness","streetAddress":"Derryguile","addressLocality":"Mountmellick","addressRegion":"Co. Laois","postalCode":"R32 YX49","addressCountry":"IE","areaServed":"Ireland","sameAs":[]}'::jsonb
        || CASE WHEN jsonb_typeof("published" -> 'organization') = 'object' THEN "published" -> 'organization' ELSE '{}'::jsonb END
    )
    ELSE "published"
  END
WHERE "key" = 'seo.defaults' AND jsonb_typeof("draft") = 'object';
