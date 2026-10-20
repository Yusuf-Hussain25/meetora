// Fills Meetora with realistic demo data: Clerk accounts with photos, two weeks of past
// meetings (attendance, chat, live-caption transcripts) and upcoming scheduled meetings.
//
//   npm run seed                      # demo account + teammates + meetings
//   npm run seed -- --with you@mail   # also add an existing Meetora account to the meetings
//
// Safe to re-run: users are reused and meetings are keyed, so nothing is duplicated.
// Accounts use the @meetora-demo.dev domain. Passwords come from server/.env.
import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

const { CLERK_SECRET_KEY, DATABASE_URL, DEMO_EMAIL = "demo@meetora-demo.dev", DEMO_PASSWORD, SEED_PASSWORD } = process.env;
if (!CLERK_SECRET_KEY || !DATABASE_URL || !DEMO_PASSWORD || !SEED_PASSWORD) {
  console.error("Missing env: CLERK_SECRET_KEY, DATABASE_URL, DEMO_PASSWORD and SEED_PASSWORD must be set in server/.env");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const sql = neon(DATABASE_URL);
const withIdx = process.argv.indexOf("--with");
const withEmail = withIdx > -1 ? process.argv[withIdx + 1] : null;

const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const portrait = (g, n) => `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

const PEOPLE = {
  demo: { first: "Alex", last: "Morgan", email: DEMO_EMAIL, img: portrait("men", 46), password: DEMO_PASSWORD },
  priya: { first: "Priya", last: "Sharma", img: portrait("women", 44) },
  rohan: { first: "Rohan", last: "Mehta", img: portrait("men", 32) },
  aisha: { first: "Aisha", last: "Khan", img: portrait("women", 68) },
  lena: { first: "Lena", last: "Fischer", img: portrait("women", 12) },
  diego: { first: "Diego", last: "Alvarez", img: portrait("men", 75) },
  sophie: { first: "Sophie", last: "Laurent", img: portrait("women", 26) },
  kenji: { first: "Kenji", last: "Tanaka", img: portrait("men", 52) },
  omar: { first: "Omar", last: "Haddad", img: portrait("men", 11) },
};

// ------------------------------------------------------------------ users
async function ensureClerkUser(key, p) {
  const email = p.email || `${key}@meetora-demo.dev`;
  const found = await clerk.users.getUserList({ emailAddress: [email] });
  let user = found.data[0];
  if (!user) {
    user = await clerk.users.createUser({
      emailAddress: [email],
      password: p.password || SEED_PASSWORD,
      firstName: p.first,
      lastName: p.last,
      skipPasswordChecks: true,
    });
    console.log(`  + Clerk user ${email}`);
  }
  if (!user.hasImage) {
    try {
      const res = await fetch(p.img);
      const blob = new Blob([await res.arrayBuffer()], { type: "image/jpeg" });
      user = await clerk.users.updateUserProfileImage(user.id, { file: blob });
    } catch (err) {
      console.warn(`  ! could not set photo for ${email}: ${err.message}`);
    }
  }
  const name = `${p.first} ${p.last}`;
  await sql`
    INSERT INTO users (id, name, email, image, plan)
    VALUES (${user.id}, ${name}, ${email}, ${p.img}, 'free')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image, updated_at = NOW()`;
  return { id: user.id, name, key };
}

// ------------------------------------------------------------- conversation
const CHATS = {
  product: [
    ["demo", "Morning all! Agenda is in the doc, starting with the onboarding results."],
    ["priya", "Activation is up 4.1 points since Monday 🎉"],
    ["rohan", "Nice. Did the drop-off on step 3 improve too?"],
    ["priya", "Yes, from 38% to 24%. The shorter form really helped."],
    ["aisha", "Sharing the funnel dashboard link here: meetora.app/d/onboarding"],
    ["diego", "Can we get the same flow on mobile next sprint?"],
    ["demo", "Adding it to the roadmap. Let's review on Friday."],
    ["rohan", "👍 I'll write up the tech notes today"],
  ],
  design: [
    ["sophie", "Figma link for v3: the flows are on page 2"],
    ["lena", "Love the new empty states, very friendly"],
    ["demo", "The progress bar feels a bit heavy on small screens"],
    ["kenji", "Agree, maybe a thinner stepper instead?"],
    ["sophie", "Good call, I'll try both and post them in the channel"],
  ],
  sprint: [
    ["demo", "Goal for this sprint: ship scheduled meetings end to end"],
    ["rohan", "Backend API is ready, needs review"],
    ["kenji", "I'll take the reminder emails"],
    ["priya", "QA plan is in the tracker, 18 test cases"],
    ["diego", "Mobile build can go out Thursday if review lands tomorrow"],
    ["omar", "Customer beta list is ready, 40 teams signed up"],
  ],
  generic: [
    ["demo", "Thanks for joining everyone"],
    ["priya", "Notes doc is linked in the invite"],
    ["rohan", "Quick question about the timeline, can we push the review by a day?"],
    ["demo", "Works for me"],
  ],
};

const TRANSCRIPTS = {
  product: [
    ["demo", "Okay, let's get started. First up, the new onboarding flow."],
    ["priya", "It's been live for ten percent of new users since Monday."],
    ["priya", "Activation went from thirty one to thirty five percent."],
    ["rohan", "That's a big jump. Is it still significant if we exclude the referral traffic?"],
    ["priya", "Yes, it holds at about three and a half points."],
    ["aisha", "Support tickets about setup are down too, roughly a third fewer."],
    ["diego", "Can we ship the same flow to the mobile app next sprint?"],
    ["demo", "Yes, let's put it on the roadmap and review it on Friday."],
    ["rohan", "I'll write the technical notes today and share them in chat."],
    ["demo", "Great. Thanks everyone, see you Friday."],
  ],
  sprint: [
    ["demo", "The goal for this sprint is scheduled meetings, end to end."],
    ["rohan", "The API is done. It needs a review before we merge."],
    ["kenji", "I can pick up the reminder emails."],
    ["priya", "I've written eighteen test cases for QA."],
    ["diego", "If the review lands tomorrow, the mobile build goes out Thursday."],
    ["demo", "Perfect. Let's check in at standup."],
  ],
  generic: [
    ["demo", "Thanks for making time for this."],
    ["priya", "Happy to. I shared the notes before the call."],
    ["demo", "Let's go through the open questions first."],
    ["rohan", "The main one is whether we can move the review by a day."],
    ["demo", "That works. I'll update the invite after this."],
  ],
};

// ----------------------------------------------------------------- meetings
const PAST = [
  { key: "standup-today", title: "Daily standup", host: "demo", ago: 3 * HOUR, mins: 15, people: ["priya", "rohan", "kenji", "diego"], chat: "generic", transcript: "generic" },
  { key: "product-weekly", title: "Product weekly", host: "demo", ago: 1 * DAY + 2 * HOUR, mins: 42, people: ["priya", "rohan", "aisha", "diego"], chat: "product", transcript: "product" },
  { key: "design-crit", title: "Design critique: onboarding v3", host: "sophie", ago: 2 * DAY + 5 * HOUR, mins: 35, people: ["lena", "kenji"], chat: "design" },
  { key: "one-on-one", title: "1:1 Alex / Priya", host: "priya", ago: 3 * DAY + 1 * HOUR, mins: 28, people: [], chat: "generic", transcript: "generic" },
  { key: "sprint-planning", title: "Sprint planning", host: "demo", ago: 4 * DAY + 3 * HOUR, mins: 55, people: ["priya", "rohan", "kenji", "diego", "omar"], chat: "sprint", transcript: "sprint" },
  { key: "northwind", title: "Customer call: Northwind", host: "omar", ago: 5 * DAY + 6 * HOUR, mins: 31, people: ["aisha"], chat: "generic" },
  { key: "hiring", title: "Hiring sync", host: "demo", ago: 6 * DAY + 2 * HOUR, mins: 22, people: ["sophie", "omar"] },
  { key: "launch-review", title: "Marketing launch review", host: "aisha", ago: 8 * DAY + 4 * HOUR, mins: 47, people: ["sophie", "lena", "omar"], chat: "generic" },
  { key: "all-hands", title: "Engineering all-hands", host: "rohan", ago: 10 * DAY + 1 * HOUR, mins: 64, people: ["priya", "aisha", "lena", "diego", "sophie", "kenji", "omar"], chat: "sprint", transcript: "sprint" },
  { key: "coffee", title: "Coffee chat ☕", host: "lena", ago: 12 * DAY + 7 * HOUR, mins: 18, people: [] },
  { key: "roadmap", title: "Roadmap brainstorm", host: "demo", ago: 13 * DAY + 3 * HOUR, mins: 51, people: ["priya", "rohan", "aisha"], chat: "product" },
];

const atHour = (daysAhead, hour) => {
  const d = new Date(Date.now() + daysAhead * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const UPCOMING = [
  { key: "investor-prep", title: "Investor update prep", when: () => new Date(Math.ceil((Date.now() + 2 * HOUR) / (30 * MIN)) * 30 * MIN), description: "Walk through the Q3 numbers and the deck before Thursday." },
  { key: "mobile-review", title: "Design review: mobile app", when: () => atHour(1, 11), description: "Sophie presents the new mobile onboarding." },
  { key: "quarterly", title: "Quarterly planning", when: () => atHour(3, 15), description: "Goals, owners and the top three bets for next quarter." },
  { key: "retro", title: "Team retro", when: () => atHour(6, 16), description: "What went well, what didn't, what we try next." },
];

// Stable meeting code per seed key, in the app's abc-def-ghi format
const codeFor = (key) => {
  const h = createHash("sha256").update(`meetora-seed:${key}`).digest();
  const letters = Array.from(h.subarray(0, 9), (b) => String.fromCharCode(97 + (b % 26))).join("");
  return `${letters.slice(0, 3)}-${letters.slice(3, 6)}-${letters.slice(6, 9)}`;
};

async function insertMeeting({ code, title, description = "", hostId, status, createdAt, startedAt = null, scheduledFor = null, endedAt = null }) {
  const rows = await sql`
    INSERT INTO meetings (meeting_id, title, description, host_id, status, created_at, started_at, scheduled_for, ended_at, updated_at)
    VALUES (${code}, ${title}, ${description}, ${hostId}, ${status}, ${createdAt}, ${startedAt}, ${scheduledFor}, ${endedAt}, NOW())
    ON CONFLICT (meeting_id) DO NOTHING
    RETURNING id`;
  return rows[0]?.id || null;
}

async function seedPast(m, users, extraUser) {
  const code = codeFor(m.key);
  const start = new Date(Date.now() - m.ago);
  const end = new Date(start.getTime() + m.mins * MIN);
  const host = users[m.host];
  let meetingId = await insertMeeting({ code, title: m.title, hostId: host.id, status: "ended", createdAt: new Date(start.getTime() - 2 * MIN), startedAt: start, endedAt: end });
  const created = Boolean(meetingId);
  if (!meetingId) [{ id: meetingId }] = await sql`SELECT id FROM meetings WHERE meeting_id = ${code}`;

  const attendees = [...new Set([m.host, "demo", ...m.people])].map((k) => users[k]);
  if (extraUser) attendees.push(extraUser);

  // Attendance: people trickle in during the first few minutes, a couple leave early
  for (const [i, u] of attendees.entries()) {
    const exists = await sql`SELECT 1 FROM meeting_participants WHERE meeting_id = ${meetingId} AND user_id = ${u.id}`;
    if (exists.length) continue;
    const joined = new Date(start.getTime() + Math.min(i, 5) * 47 * 1000);
    const left = i > 3 && i % 3 === 0 ? new Date(end.getTime() - (5 + i) * MIN) : end;
    await sql`INSERT INTO meeting_participants (meeting_id, user_id, name, joined_at, left_at) VALUES (${meetingId}, ${u.id}, ${u.name}, ${joined}, ${left})`;
  }
  if (!created) return false;

  const speak = (lines) => lines
    .map(([k, text]) => [users[k] && attendees.includes(users[k]) ? users[k] : host, text]);

  if (m.chat) {
    const lines = speak(CHATS[m.chat]);
    for (const [i, [u, text]] of lines.entries()) {
      const at = new Date(start.getTime() + ((i + 1) / (lines.length + 1)) * m.mins * MIN);
      await sql`INSERT INTO meeting_messages (meeting_id, sender_id, sender_name, text, timestamp) VALUES (${meetingId}, ${u.id}, ${u.name}, ${text}, ${at})`;
    }
  }
  if (m.transcript) {
    const lines = speak(TRANSCRIPTS[m.transcript]);
    for (const [i, [u, text]] of lines.entries()) {
      const at = new Date(start.getTime() + (i + 1) * 40 * 1000);
      await sql`INSERT INTO meeting_transcripts (meeting_id, speaker_id, speaker_name, text, timestamp) VALUES (${meetingId}, ${u.id}, ${u.name}, ${text}, ${at})`;
    }
  }
  return true;
}

async function seedUpcoming(m, hostUser, keyPrefix = "") {
  const when = m.when();
  const id = await insertMeeting({
    code: codeFor(`${keyPrefix}${m.key}`), title: m.title, description: m.description, hostId: hostUser.id,
    status: "scheduled", createdAt: new Date(Date.now() - 2 * DAY), scheduledFor: when,
  });
  return Boolean(id);
}

// --------------------------------------------------------------------- main
console.log("Seeding Meetora demo data…");
const users = {};
for (const [key, p] of Object.entries(PEOPLE)) users[key] = await ensureClerkUser(key, p);
console.log(`✓ ${Object.keys(users).length} users ready (demo login: ${DEMO_EMAIL})`);

let extraUser = null;
if (withEmail) {
  const found = await clerk.users.getUserList({ emailAddress: [withEmail] });
  const u = found.data[0];
  if (!u) {
    console.error(`No Clerk user with email ${withEmail}. Sign up in the app first.`);
    process.exit(1);
  }
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || withEmail.split("@")[0];
  await sql`
    INSERT INTO users (id, name, email, image) VALUES (${u.id}, ${name}, ${withEmail}, ${u.imageUrl || ""})
    ON CONFLICT (id) DO NOTHING`;
  extraUser = { id: u.id, name };
  console.log(`✓ adding ${withEmail} to the demo meetings`);
}

let past = 0;
for (const m of PAST) past += (await seedPast(m, users, extraUser)) ? 1 : 0;
let upcoming = 0;
for (const m of UPCOMING) upcoming += (await seedUpcoming(m, users.demo)) ? 1 : 0;
if (extraUser) {
  for (const m of UPCOMING.slice(0, 2)) upcoming += (await seedUpcoming(m, extraUser, `${extraUser.id}:`)) ? 1 : 0;
}

console.log(`✓ ${past} new past meetings, ${upcoming} new scheduled meetings (existing ones were kept)`);
console.log("Done. Log in with the demo account or run again any time.");
