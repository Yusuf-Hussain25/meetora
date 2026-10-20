import { sql } from "../config/db.js";
import { liveParticipants } from "../lib/rooms.js";

export const FREE_MONTHLY_LIMIT = 30;
const MEETING_ID_RE = /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/;
const TZ_RE = /^[A-Za-z0-9_+\-/]{1,64}$/;
// Caps time counted for someone who never "left" (closed laptop, server restart)
const MAX_SESSION = "8 hours";

const generateMeetingId = () =>{
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment = (len)=> Array.from({length: len}, ()=> chars[Math.floor(Math.random() * chars.length)]).join("");
    return `${segment(3)}-${segment(3)}-${segment(3)}`
}

const formatMeeting = (m) => ({
    id: m.id,
    meetingId: m.meeting_id,
    title: m.title,
    description: m.description || "",
    status: m.status,
    createdAt: m.created_at,
    startedAt: m.started_at,
    scheduledFor: m.scheduled_for,
    endedAt: m.ended_at,
    host: {
        id: m.host_id,
        name: m.host_name,
        email: m.host_email,
        image: m.host_image || "",
    },
    live: liveParticipants(m.meeting_id),
});

const formatParticipant = (p) => ({
    user: p.user_id ? { id: p.user_id, email: p.email } : null,
    name: p.name,
    image: p.image || "",
    joinedAt: p.joined_at,
    leftAt: p.left_at,
});

const monthlyCount = async (userId) => {
    const [row] = await sql`
        SELECT COUNT(*)::int AS count FROM meetings
        WHERE host_id = ${userId} AND created_at >= date_trunc('month', NOW())`;
    return row.count;
};

// create an instant meeting, or schedule one for later
export const createMeeting = async (req, res)=>{
    try {
        const userId = req.user.id;
        const title = String(req.body?.title || "").trim().slice(0, 120) || "Instant meeting";
        const description = String(req.body?.description || "").trim().slice(0, 500);

        let scheduledFor = null;
        if (req.body?.scheduledFor) {
            scheduledFor = new Date(req.body.scheduledFor);
            const now = Date.now();
            if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < now - 60_000) {
                return res.status(400).json({ error: "Pick a time in the future for a scheduled meeting." });
            }
            if (scheduledFor.getTime() > now + 365 * 24 * 3600 * 1000) {
                return res.status(400).json({ error: "Meetings can be scheduled up to a year ahead." });
            }
        }

        // check meetings limit per calendar month
        if(req.user.plan !== "premium"){
            const count = await monthlyCount(userId);
            if(count >= FREE_MONTHLY_LIMIT){
                return res.status(403).json({
                    error: `Monthly limit reached. The Free plan includes ${FREE_MONTHLY_LIMIT} meetings per month. Upgrade to Premium for unlimited meetings.`,
                    limitReached: true,
                    monthlyCount: count,
                    limit: FREE_MONTHLY_LIMIT,
                })
            }
        }

        // Ensure unique ID
        let meetingId = generateMeetingId()
        let existing = await sql`SELECT id FROM meetings WHERE meeting_id = ${meetingId}`;
        while(existing.length > 0){
            meetingId = generateMeetingId();
            existing = await sql`SELECT id FROM meetings WHERE meeting_id = ${meetingId}`;
        }

        const status = scheduledFor ? "scheduled" : "active";
        const [meeting] = await sql`
            INSERT INTO meetings (meeting_id, title, description, host_id, status, scheduled_for)
            VALUES (${meetingId}, ${title}, ${description}, ${userId}, ${status}, ${scheduledFor})
            RETURNING *`;

        res.status(201).json({ meeting: formatMeeting({ ...meeting, host_name: req.user.name }) })
    } catch (error) {
        console.error("createMeeting failed:", error);
        res.status(500).json({ error: "Failed to create meeting" });
    }
}

// get meeting by id (used by the lobby before joining)
export const getMeeting = async (req, res)=>{
    try {
        const { meetingId } = req.params;
        if (!MEETING_ID_RE.test(meetingId)) {
            return res.status(404).json({ error: "Meeting not found. Check the code and try again." });
        }

        const meetings = await sql`
            SELECT m.*, u.name AS host_name, u.email AS host_email, u.image AS host_image
            FROM meetings m JOIN users u ON m.host_id = u.id
            WHERE m.meeting_id = ${meetingId}`;

        if(meetings.length === 0){
            return res.status(404).json({ error: "Meeting not found. Check the code and try again." });
        }

        const meeting = meetings[0];
        if (meeting.status === "ended"){
            return res.status(410).json({ error: "This meeting has ended.", ended: true });
        }

        res.json({ meeting: formatMeeting(meeting) })
    } catch (error) {
        console.error("Fetch Meeting failed:", error);
        res.status(500).json({ error: "Failed to fetch meeting" });
    }
}

// scheduled meetings the user hosts, plus their meetings that are live right now
export const getUpcoming = async (req, res) => {
    try {
        const userId = req.user.id;
        const scheduled = await sql`
            SELECT m.*, u.name AS host_name, u.email AS host_email, u.image AS host_image
            FROM meetings m JOIN users u ON m.host_id = u.id
            WHERE m.status = 'scheduled' AND m.host_id = ${userId}
            ORDER BY m.scheduled_for ASC
            LIMIT 20`;

        const active = await sql`
            SELECT m.*, u.name AS host_name, u.email AS host_email, u.image AS host_image
            FROM meetings m JOIN users u ON m.host_id = u.id
            WHERE m.status = 'active'
              AND (m.host_id = ${userId}
                   OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = ${userId}))
            ORDER BY m.created_at DESC
            LIMIT 50`;

        res.json({
            upcoming: scheduled.map(formatMeeting),
            live: active.map(formatMeeting).filter((m) => m.live.length > 0),
        });
    } catch (error) {
        console.error("get upcoming failed:", error);
        res.status(500).json({ error: "Failed to load upcoming meetings" });
    }
}

// all past and active sessions the user hosted or joined
export const getUserSessions = async (req, res)=>{
    try {
        const userId = req.user.id;

        const meetings = await sql`
            SELECT m.*, u.name AS host_name, u.email AS host_email, u.image AS host_image,
                   (SELECT COUNT(*)::int FROM meeting_messages mm WHERE mm.meeting_id = m.id) AS message_count,
                   (SELECT COUNT(*)::int FROM meeting_transcripts mt WHERE mt.meeting_id = m.id) AS transcript_count
            FROM meetings m
            JOIN users u ON m.host_id = u.id
            WHERE m.status <> 'scheduled'
              AND (m.host_id = ${userId}
                   OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = ${userId}))
            ORDER BY COALESCE(m.started_at, m.created_at) DESC
        `;

        // One batched query for every meeting's participants
        const ids = meetings.map((m) => m.id);
        const participants = ids.length ? await sql`
            SELECT mp.*, u.email, u.image
            FROM meeting_participants mp
            LEFT JOIN users u ON mp.user_id = u.id
            WHERE mp.meeting_id = ANY(${ids})
            ORDER BY mp.joined_at ASC
        ` : [];

        res.json({
            meetings: meetings.map((m) => ({
                ...formatMeeting(m),
                messageCount: m.message_count,
                transcriptCount: m.transcript_count,
                participants: participants.filter((p) => p.meeting_id === m.id).map(formatParticipant),
            })),
        })
    } catch (error) {
        console.error("get User sessions failed:", error);
        res.status(500).json({ error: "Failed to get user sessions" });
    }
}

// one session with participants, chat and transcript (host and participants only)
export const getSessionDetails = async (req, res)=>{
    try {
        const {id} = req.params;
        const userId = req.user.id;

        const meetings = await sql`
            SELECT m.*, u.name AS host_name, u.email AS host_email, u.image AS host_image
            FROM meetings m JOIN users u ON m.host_id = u.id
            WHERE m.meeting_id = ${id}`;

        if (meetings.length === 0){
            return res.status(404).json({ error: "Session details not found" });
        }
        const m = meetings[0];

        if (m.host_id !== userId) {
            const membership = await sql`
                SELECT 1 FROM meeting_participants
                WHERE meeting_id = ${m.id} AND user_id = ${userId} LIMIT 1`;
            if (membership.length === 0) {
                return res.status(404).json({ error: "Session details not found" });
            }
        }

        const participants = await sql`
            SELECT mp.*, u.email, u.image
            FROM meeting_participants mp
            LEFT JOIN users u ON mp.user_id = u.id
            WHERE mp.meeting_id = ${m.id}
            ORDER BY mp.joined_at ASC`;

        const messages = await sql`
            SELECT mm.id, mm.sender_id, mm.sender_name, mm.text, mm.timestamp, u.image
            FROM meeting_messages mm LEFT JOIN users u ON mm.sender_id = u.id
            WHERE mm.meeting_id = ${m.id}
            ORDER BY mm.timestamp ASC`;

        const transcript = await sql`
            SELECT id, speaker_id, speaker_name, text, timestamp
            FROM meeting_transcripts
            WHERE meeting_id = ${m.id}
            ORDER BY timestamp ASC`;

        res.json({
            meeting: {
                ...formatMeeting(m),
                participants: participants.map(formatParticipant),
                messages: messages.map((msg)=>({
                    id: msg.id,
                    sender: msg.sender_id,
                    senderName: msg.sender_name,
                    senderImage: msg.image || "",
                    text: msg.text,
                    timestamp: msg.timestamp,
                })),
                transcript: transcript.map((t) => ({
                    id: t.id,
                    speaker: t.speaker_id,
                    speakerName: t.speaker_name,
                    text: t.text,
                    timestamp: t.timestamp,
                })),
            },
        });
    } catch (error) {
        console.error("get session details failed:", error);
        res.status(500).json({ error: "Failed to get session details" });
    }
}

// host-only: cancel a scheduled meeting or remove a finished one from history
export const deleteMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const [meeting] = await sql`SELECT id, host_id FROM meetings WHERE meeting_id = ${meetingId}`;
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });
        if (meeting.host_id !== req.user.id) {
            return res.status(403).json({ error: "Only the host can delete this meeting" });
        }
        if (liveParticipants(meetingId).length > 0) {
            return res.status(409).json({ error: "People are still in this meeting. End it first." });
        }
        await sql`DELETE FROM meetings WHERE id = ${meeting.id}`;
        res.json({ deleted: true });
    } catch (error) {
        console.error("delete meeting failed:", error);
        res.status(500).json({ error: "Failed to delete meeting" });
    }
}

// plan usage, lifetime totals and the last 7 days of activity for the dashboard
export const getMeetingStats = async (req, res)=>{
    try {
        const userId = req.user.id;
        const plan = req.user.plan || "free";
        const tz = TZ_RE.test(String(req.query.tz || "")) ? req.query.tz : "UTC";

        const count = await monthlyCount(userId);

        const [totals] = await sql`
            SELECT
              COUNT(DISTINCT m.id)::int AS meetings,
              COUNT(DISTINCT m.id) FILTER (WHERE m.host_id = ${userId})::int AS hosted,
              COALESCE(SUM(EXTRACT(EPOCH FROM LEAST(
                  COALESCE(mp.left_at, m.ended_at, NOW()) - mp.joined_at, ${MAX_SESSION}::interval))), 0)::float / 60 AS minutes
            FROM meeting_participants mp
            JOIN meetings m ON m.id = mp.meeting_id
            WHERE mp.user_id = ${userId} AND m.status <> 'scheduled'`;

        const [people] = await sql`
            SELECT COUNT(DISTINCT COALESCE(other.user_id, other.name))::int AS count
            FROM meeting_participants mine
            JOIN meeting_participants other ON other.meeting_id = mine.meeting_id
            WHERE mine.user_id = ${userId}
              AND (other.user_id IS NULL OR other.user_id <> ${userId})`;

        const [messages] = await sql`SELECT COUNT(*)::int AS count FROM meeting_messages WHERE sender_id = ${userId}`;

        const activity = await sql`
            WITH days AS (
                SELECT generate_series(
                    ((NOW() AT TIME ZONE ${tz})::date - 6)::timestamp,
                    ((NOW() AT TIME ZONE ${tz})::date)::timestamp,
                    interval '1 day')::date AS day
            )
            SELECT d.day,
                   COUNT(DISTINCT mp.meeting_id)::int AS meetings,
                   COALESCE(SUM(EXTRACT(EPOCH FROM LEAST(
                       COALESCE(mp.left_at, m.ended_at, NOW()) - mp.joined_at, ${MAX_SESSION}::interval))), 0)::float / 60 AS minutes
            FROM days d
            LEFT JOIN meeting_participants mp
                   ON mp.user_id = ${userId} AND (mp.joined_at AT TIME ZONE ${tz})::date = d.day
            LEFT JOIN meetings m ON m.id = mp.meeting_id
            GROUP BY d.day
            ORDER BY d.day`;

        res.json({
            plan,
            monthlyCount: count,
            monthlyLimit: plan === "premium" ? null : FREE_MONTHLY_LIMIT,
            maxParticipants: plan === "premium" ? 100 : 10,
            totals: {
                meetings: totals.meetings,
                hosted: totals.hosted,
                minutes: Math.round(totals.minutes),
                people: people.count,
                messages: messages.count,
            },
            activity: activity.map((a) => ({
                day: a.day instanceof Date ? a.day.toISOString().slice(0, 10) : String(a.day).slice(0, 10),
                meetings: a.meetings,
                minutes: Math.round(a.minutes),
            })),
        })
    } catch (error) {
        console.error("get meeting stats failed:", error);
        res.status(500).json({ error: "Failed to get meeting stats" });
    }
}
