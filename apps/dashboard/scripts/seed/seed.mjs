/**
 * Fills the local or preview database with a realistic club, from scratch.
 *
 *   npm run db:seed:local      the local Supabase stack
 *   npm run db:seed:preview    the shared preview project
 *   npm run db:reset:preview   wipe + migrate + this, in one go
 *
 * What it makes:
 *   - the teams and the real officers, from supabase/seed/officers.json
 *     (git-ignored; officers.example.json shows the shape)
 *   - 50 made-up members on @firstbyte.test, in every approval state
 *   - one semester of meetings: 7 weeks back and 7 weeks ahead of this week.
 *     Each team meets weekly, E-Board weekly, and the club every other week.
 *     Past meetings are closed with Present / Absent / Excused records, as
 *     closing attendance would leave them. Future ones have no records.
 *   - four test logins (admin, officer, member, pending) whose passwords come
 *     from TEST_*_PASSWORD (supabase/seed/.env.test-accounts locally, the
 *     PREVIEW_TEST_ACCOUNTS secret on GitHub)
 *
 * Re-runnable: it empties every app table first and restarts the ids, and
 * random choices come from a fixed seed, so each run gives the same club.
 * Dates are relative to the day it runs, so there is always recent history.
 *
 * Login accounts in auth.users are left alone, except the four test logins,
 * which are created or have their password reset. A public.users row is
 * matched to its login by email alone, the same way syncUserToDb in
 * src/lib/auth/sync-user.ts does it, so a real officer who signs up on preview
 * with their email lands on their seeded row.
 *
 * Refuses to run against anything but the local stack or the preview project.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { assertSafeTarget, run } from "./guard.mjs";

const OFFICERS_FILE =
  process.env.SEED_OFFICERS_FILE ?? "supabase/seed/officers.json";

const TEST_ACCOUNTS = [
  { key: "ADMIN", email: "test-admin@firstbyte.test", name: "Test Admin" },
  {
    key: "OFFICER",
    email: "test-officer@firstbyte.test",
    name: "Test Officer",
  },
  { key: "MEMBER", email: "test-member@firstbyte.test", name: "Test Member" },
  {
    key: "PENDING",
    email: "test-pending@firstbyte.test",
    name: "Test Pending",
  },
];

const FIRST = [
  "Aisha",
  "Ben",
  "Carmen",
  "Dev",
  "Elena",
  "Femi",
  "Grace",
  "Hiro",
  "Isabel",
  "Jamal",
  "Kira",
  "Liam",
  "Maya",
  "Noah",
  "Olivia",
  "Pranav",
  "Quinn",
  "Rosa",
  "Sami",
  "Tara",
  "Uma",
  "Victor",
  "Wen",
  "Ximena",
  "Yusuf",
  "Zoe",
  "Arjun",
  "Bianca",
  "Chen",
  "Diego",
  "Emma",
  "Farah",
  "Gabe",
  "Hana",
  "Ivan",
  "Jade",
  "Kofi",
  "Lena",
  "Marco",
  "Nia",
  "Omar",
  "Priya",
  "Ravi",
  "Sofia",
  "Theo",
  "Valeria",
  "Will",
  "Yara",
  "Zain",
  "Ana",
];
const LAST = [
  "Adams",
  "Bose",
  "Castillo",
  "Duong",
  "Eze",
  "Fischer",
  "Garcia",
  "Huang",
  "Ibrahim",
  "Jensen",
  "Kim",
  "Lopez",
  "Mehta",
  "Nguyen",
  "Okafor",
  "Park",
  "Quinto",
  "Reyes",
  "Silva",
  "Tanaka",
  "Usman",
  "Vargas",
  "Wu",
  "Xu",
  "Yilmaz",
  "Zhou",
  "Ali",
  "Brown",
  "Cruz",
  "Das",
  "Evans",
  "Flores",
  "Gupta",
  "Hughes",
  "Iyer",
  "Jones",
  "Khan",
  "Lee",
  "Moreno",
  "Novak",
  "Ortiz",
  "Patel",
  "Rossi",
  "Shah",
  "Torres",
  "Ueda",
  "Vu",
  "Walsh",
  "Young",
  "Zhang",
];
const MAJORS = [
  "Computer Science",
  "Data Science",
  "Bioengineering",
  "Mathematics",
  "Cybersecurity",
  "Mechanical Engineering",
  "Psychology",
  "Business",
  "Computer Engineering",
  "Biology",
];
const PRONOUNS = ["she/her", "he/him", "they/them", null, null];
const LOCATIONS = [
  "Richards Hall 235",
  "Snell Library 090",
  "Curry Student Center 333",
  "West Village H 108",
  "Ryder Hall 161",
];
const EXCUSES = [
  "Midterm that evening",
  "Sick",
  "Co-op interview",
  "Family event",
  "Lab ran late",
  null,
];
const COMMENTS = [
  "Great session, very hands-on.",
  "Could use more time for questions.",
  "Loved the activity.",
  "Room was a bit crowded.",
  "Clear and well paced.",
];
const CATEGORIES = ["CONTENT", "LOGISTICS", "ENGAGEMENT", "OVERALL"];

/** Small seeded random number generator (mulberry32), so every run matches. */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20261016);
const pick = (list) => list[Math.floor(random() * list.length)];
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function readOfficers() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(OFFICERS_FILE, "utf8"));
  } catch {
    throw new Error(
      `Could not read ${OFFICERS_FILE}. Copy supabase/seed/officers.example.json to supabase/seed/officers.json and fill it in.`,
    );
  }
  const { teams, officers } = parsed;
  if (!Array.isArray(teams) || !Array.isArray(officers)) {
    throw new Error(`${OFFICERS_FILE} needs a "teams" and an "officers" list.`);
  }
  const names = new Set(teams.map((t) => t.name));
  for (const o of officers) {
    for (const m of o.teams ?? []) {
      if (!names.has(m.team)) {
        throw new Error(
          `Officer ${o.name} is on "${m.team}", which is not in "teams".`,
        );
      }
    }
  }
  return { teams, officers };
}

function readPasswords() {
  return TEST_ACCOUNTS.map((a) => {
    const password = process.env[`TEST_${a.key}_PASSWORD`];
    if (!password || password.length < 6) {
      throw new Error(
        `TEST_${a.key}_PASSWORD is missing or shorter than 6 characters. See supabase/seed/.env.test-accounts.example.`,
      );
    }
    return { ...a, password };
  });
}

/** Monday 00:00 UTC of the current week. */
function startOfWeek(now) {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}

run(async () => {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!process.env.SUPABASE_URL && supabaseUrl)
    process.env.SUPABASE_URL = supabaseUrl;
  const target = assertSafeTarget([
    "DATABASE_URL",
    "DIRECT_URL",
    "SUPABASE_URL",
  ]);
  if (!supabaseUrl || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set to create the test logins.",
    );
  }

  const { teams, officers } = readOfficers();
  const testAccounts = readPasswords();
  const now = new Date();

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });

  console.log(`Seeding the ${target} database.`);
  try {
    const summary = await prisma.$transaction(
      (tx) => seedDatabase(tx, { teams, officers, now }),
      { timeout: 120_000, maxWait: 20_000 },
    );
    for (const [what, count] of Object.entries(summary)) {
      console.log(`  ${what}: ${count}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  await upsertTestLogins(
    supabaseUrl,
    process.env.SUPABASE_SECRET_KEY,
    testAccounts,
  );
  console.log("✔ Seeded. Test logins:");
  for (const a of testAccounts) console.log(`  ${a.email}`);
});

async function seedDatabase(tx, { teams, officers, now }) {
  await tx.$executeRawUnsafe(
    `TRUNCATE public.feedback, public.attendance, public.meetings,
       public.team_members, public.users, public.teams RESTART IDENTITY CASCADE`,
  );

  // --- Teams --------------------------------------------------------------
  const teamRows = await tx.team.createManyAndReturn({
    data: teams.map((t) => ({
      name: t.name,
      description: t.description ?? null,
      joinPolicy: t.joinPolicy ?? "OPEN",
    })),
  });
  const teamId = Object.fromEntries(teamRows.map((t) => [t.name, t.id]));
  const openTeams = teamRows.filter((t) => t.joinPolicy === "OPEN");
  const inviteOnly = teamRows.find((t) => t.joinPolicy === "INVITE_ONLY");

  // --- Officers -----------------------------------------------------------
  const officerRows = await tx.user.createManyAndReturn({
    data: officers.map((o) => ({
      email: o.email.toLowerCase(),
      name: o.name,
      role: o.role,
      status: "APPROVED",
    })),
  });
  const approver =
    officerRows.find((o) => o.role === "SUPER_ADMIN") ?? officerRows[0];

  // --- Test logins' rows --------------------------------------------------
  const [admin, officer, member, pending] = await tx.user.createManyAndReturn({
    data: [
      {
        email: TEST_ACCOUNTS[0].email,
        name: TEST_ACCOUNTS[0].name,
        role: "SUPER_ADMIN",
        status: "APPROVED",
      },
      {
        email: TEST_ACCOUNTS[1].email,
        name: TEST_ACCOUNTS[1].name,
        role: "NORTHEASTERN_ADMIN",
        status: "APPROVED",
      },
      {
        email: TEST_ACCOUNTS[2].email,
        name: TEST_ACCOUNTS[2].name,
        status: "APPROVED",
        preferredName: "Member",
        gradYear: 2029,
        major: "Data Science",
        submittedAt: new Date(now.getTime() - 60 * DAY),
        decidedAt: new Date(now.getTime() - 59 * DAY),
        decidedById: approver?.id ?? null,
      },
      {
        email: TEST_ACCOUNTS[3].email,
        name: TEST_ACCOUNTS[3].name,
        status: "PENDING",
        gradYear: 2030,
        major: "Computer Science",
        submittedAt: new Date(now.getTime() - DAY),
      },
    ],
  });

  // --- Made-up members ----------------------------------------------------
  // 38 approved, 6 waiting for review, 3 still onboarding, 2 denied, 1 deleted.
  const statusFor = (i) =>
    i < 38
      ? "APPROVED"
      : i < 44
        ? "PENDING"
        : i < 47
          ? "ONBOARDING"
          : i < 49
            ? "DENIED"
            : "DELETED";
  const memberData = FIRST.map((first, i) => {
    const last = LAST[i];
    const status = statusFor(i);
    const submittedAt =
      status === "ONBOARDING"
        ? null
        : new Date(now.getTime() - (5 + Math.floor(random() * 70)) * DAY);
    const decided =
      status === "APPROVED" || status === "DENIED" || status === "DELETED";
    const row = {
      email: `${first}.${last}@firstbyte.test`.toLowerCase(),
      name: `${first} ${last}`,
      status,
      preferredName: random() < 0.25 ? first.slice(0, 3) : null,
      pronouns: pick(PRONOUNS),
      gradYear: 2027 + Math.floor(random() * 4),
      major: pick(MAJORS),
      submittedAt,
      decidedAt:
        decided && submittedAt ? new Date(submittedAt.getTime() + DAY) : null,
      decidedById: decided ? (approver?.id ?? null) : null,
    };
    if (status === "DELETED") {
      // What deleteOwnAccount leaves behind (src/server/users/mutations.ts).
      Object.assign(row, {
        name: "Former member",
        preferredName: null,
        pronouns: null,
        gradYear: null,
        major: null,
        deletedAt: new Date(now.getTime() - 3 * DAY),
      });
    }
    return row;
  });
  const memberRows = await tx.user.createManyAndReturn({ data: memberData });
  // The deleted row's email has to carry its own id, so it is set afterwards.
  for (const m of memberRows.filter((m) => m.status === "DELETED")) {
    await tx.user.update({
      where: { id: m.id },
      data: { email: `deleted-${m.id}@deleted.invalid` },
    });
  }

  // --- Team memberships ---------------------------------------------------
  const memberships = [];
  const add = (userId, team, role, status, at) =>
    memberships.push({
      userId,
      teamId: typeof team === "string" ? teamId[team] : team,
      role,
      status,
      joinedAt: at ?? new Date(now.getTime() - 60 * DAY),
      decidedAt:
        status === "PENDING"
          ? null
          : (at ?? new Date(now.getTime() - 59 * DAY)),
      decidedById: status === "PENDING" ? null : (approver?.id ?? null),
    });

  officers.forEach((o, i) => {
    for (const m of o.teams ?? [])
      add(officerRows[i].id, m.team, m.role ?? "MEMBER", "APPROVED");
  });
  if (inviteOnly) {
    add(admin.id, inviteOnly.id, "MEMBER", "APPROVED");
    add(officer.id, inviteOnly.id, "MEMBER", "APPROVED");
  }
  add(officer.id, openTeams[0].id, "LEAD", "APPROVED");
  add(member.id, openTeams[0].id, "MEMBER", "APPROVED");
  if (openTeams[2]) add(member.id, openTeams[2].id, "MEMBER", "APPROVED");
  add(
    pending.id,
    openTeams[1 % openTeams.length].id,
    "MEMBER",
    "PENDING",
    new Date(now.getTime() - DAY),
  );

  memberRows.forEach((m, i) => {
    const first = openTeams[i % openTeams.length];
    const second = openTeams[(i + 2) % openTeams.length];
    const requestedAt = m.submittedAt ?? undefined;
    if (m.status === "APPROVED") {
      add(m.id, first.id, "MEMBER", "APPROVED", requestedAt);
      if (random() < 0.3)
        add(m.id, second.id, "MEMBER", "APPROVED", requestedAt);
      // A few are waiting on, or were turned down for, an extra team.
      else if (i % 9 === 0)
        add(
          m.id,
          second.id,
          "MEMBER",
          "PENDING",
          new Date(now.getTime() - 2 * DAY),
        );
      else if (i % 13 === 0)
        add(m.id, second.id, "MEMBER", "REJECTED", requestedAt);
    } else if (m.status === "PENDING") {
      add(m.id, first.id, "MEMBER", "PENDING", requestedAt);
      if (i % 2 === 0) add(m.id, second.id, "MEMBER", "PENDING", requestedAt);
    } else if (m.status === "DENIED") {
      add(m.id, first.id, "MEMBER", "REJECTED", requestedAt);
    }
  });
  // One sign-up asks for the invite-only team, as in local-ui-sample-data.sql.
  const askingForInviteOnly = memberRows.find((m) => m.status === "PENDING");
  if (inviteOnly && askingForInviteOnly) {
    add(
      askingForInviteOnly.id,
      inviteOnly.id,
      "MEMBER",
      "PENDING",
      askingForInviteOnly.submittedAt,
    );
  }
  // A user can be on a team once (@@unique([userId, teamId])).
  const seen = new Set();
  const uniqueMemberships = memberships.filter((m) => {
    const key = `${m.userId}:${m.teamId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  await tx.teamMember.createMany({ data: uniqueMemberships });

  // --- Meetings -----------------------------------------------------------
  const weekStart = startOfWeek(now);
  const meetingData = [];
  let gmNumber = 0;
  for (let week = -7; week <= 7; week++) {
    const monday = weekStart + week * 7 * DAY;
    openTeams.forEach((team, i) => {
      meetingData.push({
        title: `${team.name} team meeting`,
        type: "WORKSHOP",
        teamId: team.id,
        // Monday to Thursday, 6pm Boston time (22:00 UTC in the fall).
        scheduledAt: new Date(monday + (i % 4) * DAY + 22 * HOUR),
        location: LOCATIONS[i % LOCATIONS.length],
      });
    });
    if (inviteOnly) {
      meetingData.push({
        title: "E-Board meeting",
        type: "EBOARD_MEETING",
        teamId: inviteOnly.id,
        scheduledAt: new Date(monday + 6 * DAY + 23 * HOUR),
        location: "Curry Student Center 333",
      });
    }
    if ((week + 7) % 2 === 0) {
      gmNumber += 1;
      meetingData.push({
        title: `General Meeting #${gmNumber}`,
        type: "GENERAL_MEETING",
        teamId: null,
        scheduledAt: new Date(monday + 2 * DAY + 23 * HOUR),
        location: "Richards Hall 235",
        isRequired: true,
      });
    }
    if ((week + 7) % 3 === 1) {
      meetingData.push({
        title: "FirstBites",
        type: "FIRSTBITES",
        teamId: null,
        scheduledAt: new Date(monday + 4 * DAY + 21 * HOUR),
        location: "Snell Library 090",
        description: "Snacks and a short talk. Everyone is welcome.",
      });
    }
  }
  // A meeting counts as past once it has finished (start + 3 hours), the
  // same length migration attendance_contract_data uses.
  const isPast = (m) => m.scheduledAt.getTime() + 3 * HOUR < now.getTime();
  for (const m of meetingData) {
    if (isPast(m))
      m.attendanceClosedAt = new Date(m.scheduledAt.getTime() + 3 * HOUR);
  }
  meetingData.sort((a, b) => a.scheduledAt - b.scheduledAt);
  const meetingRows = await tx.meeting.createManyAndReturn({
    data: meetingData,
  });

  // --- Attendance for closed meetings -------------------------------------
  // Closed means every expected person has a record (see closeAttendance in
  // src/server/attendance/mutations.ts). Expected is worked out like
  // expectedUsersWhere: approved accounts, and for a team meeting, approved
  // members of that team.
  const approvedIds = [...officerRows, admin, officer, member, ...memberRows]
    .filter((u) => u.status === "APPROVED")
    .map((u) => u.id);
  const onTeam = new Map();
  for (const m of uniqueMemberships) {
    if (m.status !== "APPROVED") continue;
    if (!onTeam.has(m.teamId)) onTeam.set(m.teamId, []);
    onTeam.get(m.teamId).push(m.userId);
  }
  const approvedSet = new Set(approvedIds);

  const attendance = [];
  const feedback = [];
  for (const m of meetingRows.filter((m) => m.attendanceClosedAt)) {
    const expected =
      m.teamId === null
        ? approvedIds
        : (onTeam.get(m.teamId) ?? []).filter((id) => approvedSet.has(id));
    const recent = now.getTime() - m.scheduledAt.getTime() < 14 * DAY;
    for (const userId of expected) {
      const roll = random();
      const status =
        roll < 0.75 ? "PRESENT" : roll < 0.88 ? "ABSENT" : "EXCUSED";
      attendance.push({
        userId,
        meetingId: m.id,
        status,
        checkedInAt:
          status === "PRESENT"
            ? new Date(
                m.scheduledAt.getTime() + Math.floor(random() * 15) * 60 * 1000,
              )
            : null,
        notes: status === "EXCUSED" ? pick(EXCUSES) : null,
        // Present and Excused are set by the member; Absent by the close.
        markedById: status === "ABSENT" ? null : userId,
      });
      // Feedback opens for two weeks after a meeting. The test member never
      // leaves any, so you can try the form.
      if (
        status === "PRESENT" &&
        recent &&
        userId !== member.id &&
        random() < 0.3
      ) {
        const rating = 3 + Math.floor(random() * 3) - (random() < 0.1 ? 2 : 0);
        feedback.push({
          meetingId: m.id,
          authorId: userId,
          rating,
          comment: random() < 0.4 ? pick(COMMENTS) : null,
          category: pick(CATEGORIES),
          isAnonymous: random() < 0.3,
        });
      }
    }
  }
  await tx.attendance.createMany({ data: attendance });
  await tx.feedback.createMany({ data: feedback });

  return {
    teams: teamRows.length,
    officers: officerRows.length,
    "test-login rows": 4,
    "made-up members": memberRows.length,
    "team memberships": uniqueMemberships.length,
    "meetings (past / upcoming)": `${meetingRows.filter((m) => m.attendanceClosedAt).length} / ${meetingRows.filter((m) => !m.attendanceClosedAt).length}`,
    "attendance records": attendance.length,
    feedback: feedback.length,
  };
}

/**
 * Creates each test login, or resets its password if it exists. Email is
 * marked confirmed, so no confirmation mail is sent.
 */
async function upsertTestLogins(url, secretKey, accounts) {
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const existing = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);
    for (const u of data.users)
      if (u.email) existing.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }
  for (const a of accounts) {
    const attributes = {
      password: a.password,
      email_confirm: true,
      user_metadata: { full_name: a.name },
    };
    const id = existing.get(a.email);
    const { error } = id
      ? await supabase.auth.admin.updateUserById(id, attributes)
      : await supabase.auth.admin.createUser({ email: a.email, ...attributes });
    if (error) throw new Error(`Could not set up ${a.email}: ${error.message}`);
  }
}
