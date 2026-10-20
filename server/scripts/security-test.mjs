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

  // Host controls, reactions and captions in a fresh meeting
  const roomC = await mk(host, "Room C");
  H.emit("join-room", { roomId: roomC }); await once(H, "all-users");
  G.emit("join-room", { roomId: roomC }); await once(G, "all-users");

  const muteLeak = once(H, "force-mute", 1000);
  G.emit("host-mute", { targetSocketId: H.id });
  check("non-host cannot mute others", (await muteLeak) === null);
  const muted = once(G, "force-mute");
  H.emit("host-mute", { targetSocketId: G.id });
  check("host can ask a participant to mute", Boolean(await muted));

  const bogus = once(H, "reaction", 800);
  G.emit("reaction", { emoji: "<script>" });
  check("reactions outside the emoji set are dropped", (await bogus) === null);
  const react = once(H, "reaction");
  G.emit("reaction", { emoji: "🎉" });
  const r = await react;
  check("reaction is broadcast with the sender's name", r && r.emoji === "🎉" && r.userName === "Sec guest");

  const cap = once(H, "caption");
  G.emit("caption", { text: "this sentence goes in the transcript", final: true, lineId: "l1" });
  check("caption is relayed to the room", Boolean(await cap));
  await wait(600);
  const lines = await sql`SELECT t.speaker_id FROM meeting_transcripts t JOIN meetings m ON m.id = t.meeting_id WHERE m.meeting_id = ${roomC}`;
  check("final caption saved to transcript as the verified speaker", lines.length === 1 && lines[0].speaker_id === guest.id);

  const removedEvt = once(G, "meeting-ended");
  G.emit("host-remove", { targetSocketId: H.id }); await wait(500);
  check("non-host cannot remove the host", H.connected && (await sql`SELECT 1 FROM meetings WHERE meeting_id = ${roomC} AND status = 'active'`).length === 1);
  H.emit("host-remove", { targetSocketId: G.id });
  check("host can remove a participant", Boolean(await removedEvt));
  const rejoin = once(G, "meeting-ended");
  G.emit("join-room", { roomId: roomC });
  const rj = await rejoin;
  check("removed participant cannot rejoin", rj && /removed/i.test(rj.message));

  const del = await fetch(`${API}/api/meetings/${roomC}`, { method: "DELETE", headers: { authorization: `Bearer ${await guest.token()}` } });
  check("non-host cannot delete a meeting", del.status === 403);

  const stats = await (await fetch(`${API}/api/meetings/stats?tz=Asia/Kolkata`, { headers: { authorization: `Bearer ${await host.token()}` } })).json();
  check("stats return totals and 7 days of activity", stats.totals && stats.activity?.length === 7);

  // AI endpoints follow the same membership rule as session details
  const aiGet = async (u, path, method = "GET", body) => fetch(`${API}/api/ai${path}`, {
    method, headers: { authorization: `Bearer ${await u.token()}`, "content-type": "application/json" }, body: body && JSON.stringify(body),
  });
  check("AI status needs a session", (await fetch(`${API}/api/ai/status`)).status === 401);
  check("non-member cannot read a meeting's AI recap", (await aiGet(other, `/meetings/${roomA}/recap`)).status === 404);
  check("non-member cannot ask about a meeting", (await aiGet(other, `/meetings/${roomA}/ask`, "POST", { question: "What was decided?" })).status === 404);
  check("non-member cannot get a catch-up", (await aiGet(other, `/meetings/${roomC}/catchup`, "POST", {})).status === 404);
  check("member can read the AI recap slot", (await aiGet(guest, `/meetings/${roomA}/recap`)).status === 200);

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
