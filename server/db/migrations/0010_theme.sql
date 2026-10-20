-- The appearance theme (lib/theme): the default theme, published, so the
-- admin and public site emit no theme <style>. Existing rows are kept.
INSERT INTO "settings" ("key","draft","published","version","updated_at")
VALUES ('theme', '{"site":{"preset":"security-partners","brand":null,"tokens":{}},"admin":{"preset":"security-partners","primary":null,"accent":null,"tint":"preset","radius":0.75,"mode":"system"}}'::jsonb, '{"site":{"preset":"security-partners","brand":null,"tokens":{}},"admin":{"preset":"security-partners","primary":null,"accent":null,"tint":"preset","radius":0.75,"mode":"system"}}'::jsonb, 1, now())
ON CONFLICT ("key") DO NOTHING;
