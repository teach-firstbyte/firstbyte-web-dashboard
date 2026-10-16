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

-- Attendance. Records exist only where something happened: a check-in, an
-- excuse, or an officer's mark. Nobody gets one just for being expected.

-- Finished meetings, closed: most came. The test member missed GM #2 and
-- GM #3, so they appear under "Missed 2 of the last 3 meetings".
INSERT INTO public.attendance (user_id, meeting_id, status, checked_in_at, marked_by_id, updated_at)
SELECT u.id, m.id, s.status, CASE WHEN s.status = 'PRESENT'
    THEN m.scheduled_at + ((u.id % 9) || ' minutes')::interval END,
  u.id, now()
FROM public.meetings m
JOIN public.users u ON u.status = 'APPROVED'
CROSS JOIN LATERAL (SELECT (CASE
    WHEN u.email = 'ui-test-member@firstbyte.test' AND m.title NOT LIKE '%#1' THEN 'ABSENT'
    WHEN (u.id + m.id) % 7 = 0 THEN 'EXCUSED'
    WHEN (u.id + m.id) % 4 = 0 THEN 'ABSENT'
    ELSE 'PRESENT' END)::attendance_status AS status) s
WHERE m.title LIKE '[sample] General Meeting #%';
UPDATE public.meetings SET attendance_closed_at = scheduled_at + interval '3 hours'
WHERE title LIKE '[sample] General Meeting #%';

-- Happening now: about half have checked in. The test member hasn't yet.
INSERT INTO public.attendance (user_id, meeting_id, status, checked_in_at, marked_by_id, updated_at)
SELECT u.id, m.id, 'PRESENT', m.scheduled_at + interval '3 minutes', u.id, now()
FROM public.meetings m JOIN public.users u ON u.status = 'APPROVED'
WHERE m.title = '[sample] General Meeting: Teaching with Scratch'
  AND u.id % 2 = 0 AND u.email <> 'ui-test-member@firstbyte.test';

-- Coming up: one member already said they can't make it to the workshop, so
-- the officer home shows the notice. The test member hasn't, so you can try it.
INSERT INTO public.attendance (user_id, meeting_id, status, notes, marked_by_id, updated_at)
SELECT u.id, m.id, 'EXCUSED', 'Midterm that evening', u.id, now()
FROM public.meetings m, public.users u
WHERE m.title = '[sample] Workshop: Intro to Python'
  AND u.id = (SELECT min(id) FROM public.users
              WHERE status = 'APPROVED' AND email <> 'ui-test-member@firstbyte.test');

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

SELECT title, scheduled_at, (SELECT count(*) FROM public.attendance WHERE meeting_id = m.id) AS records
FROM public.meetings m WHERE title LIKE '[sample]%' ORDER BY scheduled_at;
