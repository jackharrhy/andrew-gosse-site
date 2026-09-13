-- Mug's existing public router serves andrewgossecomposer.com.
-- Correct only the initial framework-rewrite default; preserve other configured origins.
UPDATE site_preferences
SET canonical_origin = 'https://andrewgossecomposer.com'
WHERE id = 'preferences' AND canonical_origin = 'https://andrewgosse.com';
