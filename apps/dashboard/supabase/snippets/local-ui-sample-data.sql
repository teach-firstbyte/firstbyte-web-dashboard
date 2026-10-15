-- Sample data for trying the redesigned dashboard locally. Run AFTER the two
-- UI test accounts exist (see the bottom of local-test-fixtures.sql):
--
--   docker exec -i supabase_db_firstbyte-2025 psql -U postgres < supabase/snippets/local-ui-sample-data.sql
--
-- Times are relative to now(), so there is always one meeting happening when
-- you run it. Safe to re-run: it clears what it created first.

BEGIN;

DELETE FROM public.meetings WHERE title LIKE '[sample]%';
DELETE FROM public.users WHERE email LIKE '%@sample.firstbyte.test';

-- The two test accounts: an approved officer and an approved member.
INSERT INTO public.users (email, name, role, status, preferred_name, grad_year, major, submitted_at, updated_at)
VALUES
  ('ui-test-officer@firstbyte.test', 'UI Test Officer', 'NORTHEASTERN_ADMIN', 'APPROVED', 'Officer', 2027, 'Computer Science', now(), now()),
  ('ui-test-member@firstbyte.test',  'UI Test Member',  'NORTHEASTERN_STUDENT', 'APPROVED', 'Member', 2029, 'Data Science', now(), now())
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status,
  preferred_name = EXCLUDED.preferred_name, grad_year = EXCLUDED.grad_year, major = EXCLUDED.major;

-- The member is on CS Curricula.
INSERT INTO public.team_members (user_id, team_id, role, status)
SELECT u.id, t.id, 'MEMBER', 'APPROVED'
FROM public.users u, public.teams t
WHERE u.email = 'ui-test-member@firstbyte.test' AND t.name = 'CS Curricula'
ON CONFLICT (user_id, team_id) DO UPDATE SET status = 'APPROVED';

-- Two sign-ups waiting for approval, one asking for an invite-only team.
INSERT INTO public.users (email, name, status, grad_year, major, submitted_at, updated_at)
VALUES
  ('daniel.reyes@sample.firstbyte.test', 'Daniel Reyes', 'PENDING', 2028, 'Data Science', now() - interval '1 day', now()),
  ('priya.shah@sample.firstbyte.test',   'Priya Shah',   'PENDING', 2030, 'Bioengineering', now() - interval '4 hours', now());
INSERT INTO public.team_members (user_id, team_id, status)
SELECT u.id, t.id, 'PENDING' FROM public.users u, public.teams t
WHERE (u.email = 'daniel.reyes@sample.firstbyte.test' AND t.name = 'Software Website')
   OR (u.email = 'priya.shah@sample.firstbyte.test' AND t.name IN ('STEM Curricula', 'E-Board'));

-- Meetings: three finished required GMs, one live now, two coming up.
INSERT INTO public.meetings (title, type, team_id, scheduled_at, location, is_required, description, updated_at)
VALUES
  ('[sample] General Meeting #1', 'GENERAL_MEETING', NULL, now() - interval '21 days', 'Richards Hall 235', true, NULL, now()),
  ('[sample] General Meeting #2', 'GENERAL_MEETING', NULL, now() - interval '14 days', 'Richards Hall 235', true, NULL, now()),
  ('[sample] General Meeting #3: Lesson planning', 'GENERAL_MEETING', NULL, now() - interval '7 days', 'Richards Hall 235', true, NULL, now()),
  ('[sample] General Meeting: Teaching with Scratch', 'GENERAL_MEETING', NULL, now() - interval '20 minutes', 'Richards Hall 235', true,
     'Practice the Scratch lesson we teach at partner schools next week.', now()),
  ('[sample] FirstBites: Curriculum dry run', 'FIRSTBITES', (SELECT id FROM public.teams WHERE name = 'CS Curricula'),
     date_trunc('day', now()) + interval '2 days 18 hours', 'Snell Library 090', false, NULL, now()),
  ('[sample] Workshop: Intro to Python', 'WORKSHOP', NULL, date_trunc('day', now()) + interval '6 days 19 hours', 'Richards Hall 235', false, NULL, now());

-- Rosters: every approved member on every club-wide meeting, the team for team ones.
INSERT INTO public.attendance (user_id, meeting_id, status, updated_at)
SELECT u.id, m.id, 'REGISTERED', now()
FROM public.meetings m JOIN public.users u ON u.status = 'APPROVED'
WHERE m.title LIKE '[sample]%'
  AND (m.team_id IS NULL OR EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.user_id = u.id AND tm.team_id = m.team_id AND tm.status = 'APPROVED'));

-- Finished meetings: most came. The test member missed GM #2 and GM #3, so
-- they appear under "Missed 2 of the last 3 meetings".
UPDATE public.attendance a SET
  status = (CASE
    WHEN u.email = 'ui-test-member@firstbyte.test' AND m.title NOT LIKE '%#1' THEN 'ABSENT'
    WHEN (a.user_id + m.id) % 4 = 0 THEN 'ABSENT'
    ELSE 'PRESENT' END)::attendance_status,
  checked_in_at = m.scheduled_at + ((a.user_id % 9) || ' minutes')::interval
FROM public.meetings m, public.users u
WHERE a.meeting_id = m.id AND a.user_id = u.id
  AND m.title LIKE '[sample] General Meeting #%';
UPDATE public.attendance SET checked_in_at = NULL WHERE status = 'ABSENT';

-- Happening now: about half have checked in. The test member hasn't yet.
UPDATE public.attendance a SET status = 'PRESENT', checked_in_at = m.scheduled_at + interval '3 minutes'
FROM public.meetings m, public.users u
WHERE a.meeting_id = m.id AND a.user_id = u.id
  AND m.title = '[sample] General Meeting: Teaching with Scratch'
  AND a.user_id % 2 = 0 AND u.email <> 'ui-test-member@firstbyte.test';

-- Feedback on GM #3, including one low rating. The test member came to GM #1
-- and hasn't rated anything, so GM #1 is too old to ask about (two-week window).
INSERT INTO public.feedback (meeting_id, author_id, rating, comment, category, is_anonymous, updated_at)
SELECT m.id, a.user_id,
  CASE WHEN row_number() OVER (ORDER BY a.user_id) = 1 THEN 2 ELSE 4 + (a.user_id % 2) END,
  CASE WHEN row_number() OVER (ORDER BY a.user_id) = 1 THEN 'Room was packed and I could not hear from the back.' ELSE NULL END,
  'OVERALL'::feedback_category, row_number() OVER (ORDER BY a.user_id) = 1, now()
FROM public.attendance a JOIN public.meetings m ON m.id = a.meeting_id
WHERE m.title = '[sample] General Meeting #3: Lesson planning' AND a.status = 'PRESENT';

COMMIT;

SELECT title, scheduled_at, (SELECT count(*) FROM public.attendance WHERE meeting_id = m.id) AS roster
FROM public.meetings m WHERE title LIKE '[sample]%' ORDER BY scheduled_at;
