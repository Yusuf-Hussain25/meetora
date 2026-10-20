// Security test for the Meetora API and sockets, using real Clerk sessions.
// Needs the server running (npm run server). Creates throwaway users and deletes them afterwards.
// Usage: npm run test:security
import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";
import { io } from "socket.io-client";

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const sql = neon(process.env.DATABASE_URL);

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const users = [];
async function makeUser(tag) {
  const email = `sectest-${tag}-${Date.now()}@meetora-demo.dev`;
  const u = await clerk.users.createUser({ emailAddress: [email], password: `Sec!${Date.now()}xYz`, firstName: "Sec", lastName: tag, skipPasswordChecks: true });
  users.push(u.id);
  const s = await clerk.sessions.createSession({ userId: u.id });
  const token = async () => (await clerk.sessions.getToken(s.id)).jwt;
  return { id: u.id, token };
}
const connect = (token) => new Promise((resolve) => {
  const s = io(API, { auth: { token }, transports: ["websocket"], reconnection: false });
  s.on("connect", () => resolve({ s, ok: true }));
  s.on("connect_error", (e) => resolve({ s, ok: false, err: e.message }));
});
const once = (s, ev, ms = 3000) => new Promise((r) => { const t = setTimeout(() => r(null), ms); s.once(ev, (d) => { clearTimeout(t); r(d ?? true); }); });

try {
  const host = await makeUser("host"), guest = await makeUser("guest"), other = await makeUser("other");

  const anon = await connect(undefined);
  check("socket without token is rejected", !anon.ok && anon.err === "unauthorized");
  const forged = await connect("not-a-jwt");
  check("socket with forged token is rejected", !forged.ok);

  const r401 = await fetch(`${API}/api/meetings/stats`);
  check("REST without token -> 401", r401.status === 401);

  const mk = async (u, title) => (await (await fetch(`${API}/api/meetings`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await u.token()}` }, body: JSON.stringify({ title }) })).json()).meeting.meetingId;
  const roomA = await mk(host, "Room A");
  const roomB = await mk(other, "Room B");
  check("host can create meeting", /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/.test(roomA));

  const H = (await connect(await host.token())).s;
  const G = (await connect(await guest.token())).s;
  const O = (await connect(await other.token())).s;
  O.emit("join-room", { roomId: roomB }); await once(O, "all-users");
  H.emit("join-room", { roomId: roomA }); await once(H, "all-users");
  const joined = once(H, "user-joined");
  G.emit("join-room", { roomId: roomA, user: { id: host.id, name: "Spoofed Host" } });
  const existing = await once(G, "all-users");
  const j = await joined;
  check("guest sees host in room", Array.isArray(existing) && existing.some((p) => p.userId === host.id));
  check("client-supplied identity is ignored", j && j.userId === guest.id && j.userName !== "Spoofed Host");

  // Signaling cannot reach a socket in another meeting
  const leak = once(O, "offer", 1000);
  G.emit("offer", { targetSocketId: O.id, sdp: { type: "offer", sdp: "x" } });
  check("offer to socket in another room is dropped", (await leak) === null);

  // Chat sender comes from the verified user
  const got = once(H, "receive-message");
  G.emit("send-message", { roomId: roomA, message: { text: "hello", senderId: host.id, senderName: "Fake" } });
  const msg = await got;
  check("message sender is the verified guest", msg && msg.senderId === guest.id);

  // Guest cannot end the meeting
  G.emit("end-meeting", { roomId: roomA }); await wait(800);
  const [a1] = await sql`SELECT status FROM meetings WHERE meeting_id = ${roomA}`;
  check("non-host cannot end meeting", a1.status === "active");

  // Host ends: guest notified, other room untouched
  const gEnded = once(G, "meeting-ended"), oEnded = once(O, "meeting-ended", 1200);
  H.emit("end-meeting", { roomId: roomA });
  check("guest receives meeting-ended", Boolean(await gEnded));
  check("other meeting does not receive meeting-ended", (await oEnded) === null);
  const [a2] = await sql`SELECT status, ended_at FROM meetings WHERE meeting_id = ${roomA}`;
  check("meeting marked ended in DB", a2.status === "ended" && a2.ended_at);
  const open = await sql`SELECT count(*)::int AS n FROM meeting_participants mp JOIN meetings m ON m.id = mp.meeting_id WHERE m.meeting_id = ${roomA} AND mp.left_at IS NULL`;
  check("participants have left_at after end", open[0].n === 0);

  // Session details are private to participants
  const det = await fetch(`${API}/api/meetings/sessions/${roomA}`, { headers: { authorization: `Bearer ${await other.token()}` } });
  check("non-participant cannot read session details", det.status === 404);
  const det2 = await fetch(`${API}/api/meetings/sessions/${roomA}`, { headers: { authorization: `Bearer ${await guest.token()}` } });
  check("participant can read session details", det2.status === 200);

  [H, G, O].forEach((s) => s.close());
} catch (e) {
  fail++; console.error("ERROR", e);
} finally {
  // remove test users and their data
  if (users.length) await sql`DELETE FROM users WHERE id = ANY(${users})`;
  for (const id of users) await clerk.users.deleteUser(id).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
