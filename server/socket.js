import { verifyToken } from "@clerk/backend";
import { sql } from "./config/db.js";
import { ensureUser } from "./lib/users.js";
import { getRoom, rooms } from "./lib/rooms.js";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CAPTION_LENGTH = 500;
const CHAT_HISTORY_LIMIT = 200;
const REACTIONS = new Set(["👍", "❤️", "😂", "🎉", "👏", "🔥", "😮", "💚"]);
// A meeting nobody returns to for this long is ended automatically
const AUTO_END_MS = 10 * 60 * 1000;

const endMeetingInDb = async (meetingDbId, { useLastActivity = false } = {}) => {
    if (useLastActivity) {
        await sql`
            UPDATE meetings SET status = 'ended', updated_at = NOW(),
                ended_at = COALESCE((SELECT MAX(left_at) FROM meeting_participants WHERE meeting_id = ${meetingDbId}), NOW())
            WHERE id = ${meetingDbId} AND status = 'active'`;
    } else {
        await sql`UPDATE meetings SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE id = ${meetingDbId}`;
    }
    await sql`UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = ${meetingDbId} AND left_at IS NULL`;
};

// Ends the meeting if the room is still empty after AUTO_END_MS
const scheduleAutoEnd = (roomId, meetingDbId) => {
    const room = getRoom(roomId, true);
    clearTimeout(room.emptyTimer);
    room.emptyTimer = setTimeout(async () => {
        const current = rooms.get(roomId);
        if (current && current.participants.size > 0) return;
        rooms.delete(roomId);
        try {
            await endMeetingInDb(meetingDbId, { useLastActivity: true });
        } catch (err) {
            console.error("Auto-end failed:", err);
        }
    }, AUTO_END_MS);
    room.emptyTimer.unref?.();
};

// After a restart nobody is connected: give every active meeting the same grace period
export const resumeActiveMeetings = async () => {
    const active = await sql`SELECT id, meeting_id FROM meetings WHERE status = 'active'`;
    active.forEach((m) => scheduleAutoEnd(m.meeting_id, m.id));
    return active.length;
};

export function setupSocketIO(io){
    // Every socket must carry a valid Clerk session token. The user id comes from the
    // verified token, never from the client payload.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("unauthorized"));

            const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
            const user = await ensureUser(payload.sub);
            socket.data.user = { id: user.id, name: user.name, image: user.image };
            next();
        } catch (err) {
            console.error("Socket auth failed:", err.message);
            next(new Error("unauthorized"));
        }
    });

    io.on("connection", (socket)=>{
        const authUser = socket.data.user;
        let currentRoomId = null;
        let currentUser = null;
        let currentMeeting = null; // { id, hostId }

        const room = () => (currentRoomId ? rooms.get(currentRoomId) : null);
        const isInRoom = (socketId) => Boolean(room()?.participants.has(socketId));
        const isHost = () => Boolean(currentMeeting && currentMeeting.hostId === authUser.id);

        // Marks this user as gone from the meeting once their last socket in the room leaves
        const markLeft = async (roomId, meetingDbId) => {
            const stillHere = Array.from(rooms.get(roomId)?.participants.values() || []).some((p) => p.userId === authUser.id);
            if (stillHere) return;
            try {
                await sql`
                    UPDATE meeting_participants SET left_at = NOW()
                    WHERE meeting_id = ${meetingDbId} AND user_id = ${authUser.id} AND left_at IS NULL`;
            } catch (err) {
                console.error("Error recording participant leave:", err);
            }
        };

        const leaveCurrentRoom = async () => {
            if (!currentRoomId) return;
            const roomId = currentRoomId;
            const meeting = currentMeeting;
            const state = rooms.get(roomId);

            socket.leave(roomId);
            currentRoomId = null;
            currentMeeting = null;

            if (state) {
                state.participants.delete(socket.id);
                socket.to(roomId).emit("user-left", { socketId: socket.id, user: currentUser });
                if (state.participants.size === 0 && meeting) scheduleAutoEnd(roomId, meeting.id);
            }
            if (meeting) await markLeft(roomId, meeting.id);
        };
        socket.data.leaveRoom = leaveCurrentRoom;

        const updateSelf = (patch, event) => {
            if (!currentRoomId || !currentUser) return;
            Object.assign(currentUser, patch);
            socket.to(currentRoomId).emit(event, { socketId: socket.id, ...patch });
        };

        // User joins a meeting room
        socket.on("join-room", async ({roomId, audioEnabled = true, videoEnabled = true}) => {
            try {
                if (typeof roomId !== "string") return;
                if (currentRoomId) await leaveCurrentRoom();

                const meetings = await sql`
                    SELECT id, host_id, status, title, started_at, created_at FROM meetings WHERE meeting_id = ${roomId}`;

                if (meetings.length === 0){
                    socket.emit("meeting-ended", {message: "Meeting not found."})
                    return;
                }
                const meeting = meetings[0];

                if (meeting.status === "ended"){
                    socket.emit("meeting-ended", {message: "This meeting has already ended."})
                    return;
                }

                const state = getRoom(roomId, true);
                if (state.removed.has(authUser.id)) {
                    socket.emit("meeting-ended", { message: "The host removed you from this meeting." });
                    return;
                }

                // Enforce participant limits from the host's plan (10 Free, 100 Premium)
                const hosts = await sql`SELECT plan FROM users WHERE id = ${meeting.host_id}`;
                const hostPlan = hosts[0]?.plan || "free";
                const maxParticipants = hostPlan === "premium" ? 100 : 10;

                if (state.participants.size >= maxParticipants){
                    socket.emit("meeting-ended", {
                        message: `This meeting is full (max ${maxParticipants} people on the host's ${hostPlan} plan).`,
                    })
                    return;
                }

                // First join starts a scheduled meeting and stamps the real start time
                let startedAt = meeting.started_at;
                if (meeting.status === "scheduled" || !startedAt) {
                    const [started] = await sql`
                        UPDATE meetings SET status = 'active', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
                        WHERE id = ${meeting.id} RETURNING started_at`;
                    startedAt = started.started_at;
                }

                clearTimeout(state.emptyTimer);
                state.emptyTimer = null;

                currentRoomId = roomId;
                currentMeeting = { id: meeting.id, hostId: meeting.host_id };
                currentUser = {
                    socketId: socket.id,
                    userId: authUser.id,
                    userName: authUser.name,
                    image: authUser.image,
                    isHost: meeting.host_id === authUser.id,
                    audioEnabled: Boolean(audioEnabled),
                    videoEnabled: Boolean(videoEnabled),
                    handRaised: false,
                    screenSharing: false,
                    joinedAt: new Date().toISOString(),
                }

                socket.join(roomId)

                // Get existing participants in the room, then add the newcomer
                const existingUsers = Array.from(state.participants.values());
                state.participants.set(socket.id, currentUser);

                // One attendance row per user per meeting; a rejoin clears left_at
                const updated = await sql`
                    UPDATE meeting_participants SET left_at = NULL, name = ${authUser.name}
                    WHERE meeting_id = ${meeting.id} AND user_id = ${authUser.id}
                    RETURNING id`;
                if (updated.length === 0) {
                    await sql`
                        INSERT INTO meeting_participants (meeting_id, user_id, name, joined_at)
                        VALUES (${meeting.id}, ${authUser.id}, ${authUser.name}, NOW())`;
                }

                const history = await sql`
                    SELECT * FROM (
                        SELECT mm.id, mm.sender_id, mm.sender_name, mm.text, mm.timestamp, u.image
                        FROM meeting_messages mm LEFT JOIN users u ON u.id = mm.sender_id
                        WHERE mm.meeting_id = ${meeting.id}
                        ORDER BY mm.timestamp DESC LIMIT ${CHAT_HISTORY_LIMIT}
                    ) recent ORDER BY timestamp ASC`;

                socket.emit("room-state", {
                    meeting: { title: meeting.title, hostId: meeting.host_id, startedAt },
                    self: currentUser,
                    messages: history.map((m) => ({
                        id: m.id, senderId: m.sender_id, senderName: m.sender_name, senderImage: m.image || "",
                        text: m.text, timestamp: m.timestamp,
                    })),
                });

                // Send list of existing users to the newcomer
                socket.emit("all-users", existingUsers);

                // Notify everyone else in the room
                socket.to(roomId).emit("user-joined", currentUser);

            } catch (err) {
                console.error("Error joining room in socket:", err);
                socket.emit("meeting-ended", { message: "Failed to join room." });
            }
        })

        // WebRTC signaling is only relayed between sockets in the same meeting
        socket.on('offer', ({targetSocketId, sdp})=>{
            if (!isInRoom(targetSocketId)) return;
            io.to(targetSocketId).emit("offer", {
                callerSocketId: socket.id,
                sdp,
                callerUser: currentUser,
            })
        })

        socket.on('answer', ({targetSocketId, sdp})=>{
            if (!isInRoom(targetSocketId)) return;
            io.to(targetSocketId).emit("answer", {
                responderSocketId: socket.id,
                sdp,
            })
        })

        socket.on('ice-candidate', ({ targetSocketId, candidate })=>{
            if (!isInRoom(targetSocketId)) return;
            io.to(targetSocketId).emit("ice-candidate", {
                senderSocketId: socket.id,
                candidate,
            })
        })

        socket.on('toggle-audio', ({ audioEnabled }) => updateSelf({ audioEnabled: Boolean(audioEnabled) }, 'user-toggled-audio'))
        socket.on('toggle-video', ({ videoEnabled }) => updateSelf({ videoEnabled: Boolean(videoEnabled) }, 'user-toggled-video'))
        socket.on('raise-hand', ({ raised }) => updateSelf({ handRaised: Boolean(raised) }, 'user-hand'))
        socket.on('screen-share', ({ sharing }) => updateSelf({ screenSharing: Boolean(sharing) }, 'user-screen'))

        // Emoji reactions float over the sender's tile for everyone, sender included
        socket.on('reaction', ({ emoji }) => {
            if (!currentRoomId || !REACTIONS.has(emoji)) return;
            io.in(currentRoomId).emit('reaction', {
                id: `${socket.id}-${Date.now()}`,
                socketId: socket.id,
                userName: authUser.name,
                emoji,
            });
        })

        // Live captions: interim text is relayed, final sentences are saved as the transcript
        socket.on('caption', async ({ text, final, lineId }) => {
            if (!currentRoomId || !currentMeeting) return;
            const clean = String(text || "").trim().slice(0, MAX_CAPTION_LENGTH);
            if (!clean) return;
            socket.to(currentRoomId).emit('caption', {
                socketId: socket.id,
                userId: authUser.id,
                userName: authUser.name,
                text: clean,
                final: Boolean(final),
                lineId: String(lineId || "").slice(0, 64),
            });
            if (final) {
                try {
                    await sql`
                        INSERT INTO meeting_transcripts (meeting_id, speaker_id, speaker_name, text)
                        VALUES (${currentMeeting.id}, ${authUser.id}, ${authUser.name}, ${clean})`;
                } catch (err) {
                    console.error("Error saving caption:", err);
                }
            }
        })

        // Chat message -> persist to DB & broadcast. Sender comes from the verified socket user.
        socket.on("send-message", async ({ message }) => {
            try {
                if (!currentRoomId || !currentMeeting) return;
                const text = String(message?.text || "").trim().slice(0, MAX_MESSAGE_LENGTH);
                if (!text) return;

                const [saved] = await sql`
                    INSERT INTO meeting_messages (meeting_id, sender_id, sender_name, text, timestamp)
                    VALUES (${currentMeeting.id}, ${authUser.id}, ${authUser.name}, ${text}, NOW())
                    RETURNING id, timestamp`;

                io.in(currentRoomId).emit("receive-message", {
                    id: saved.id,
                    clientId: String(message?.clientId || "").slice(0, 64),
                    senderId: authUser.id,
                    senderName: authUser.name,
                    senderImage: authUser.image || "",
                    senderSocketId: socket.id,
                    text,
                    timestamp: saved.timestamp,
                })
            } catch (err) {
                console.error("Error saving chat message to DB:", err);
            }
        })

        // Host controls ---------------------------------------------------------------
        socket.on('host-mute', ({ targetSocketId }) => {
            if (!isHost() || !isInRoom(targetSocketId) || targetSocketId === socket.id) return;
            io.to(targetSocketId).emit('force-mute', { by: authUser.name });
        })

        socket.on('host-mute-all', () => {
            if (!isHost()) return;
            socket.to(currentRoomId).emit('force-mute', { by: authUser.name });
        })

        socket.on('host-remove', async ({ targetSocketId }) => {
            if (!isHost() || !isInRoom(targetSocketId) || targetSocketId === socket.id) return;
            const target = io.sockets.sockets.get(targetSocketId);
            const targetUser = room().participants.get(targetSocketId);
            if (!target || !targetUser || targetUser.userId === authUser.id) return;

            room().removed.add(targetUser.userId);
            target.emit('meeting-ended', { message: "The host removed you from this meeting.", removed: true });
            await target.data.leaveRoom?.();
        })

        // Only the host can end the meeting for everyone
        socket.on('end-meeting', async ()=>{
            try {
                if (!currentRoomId || !isHost()) return;
                const roomId = currentRoomId;
                const meetingDbId = currentMeeting.id;

                await endMeetingInDb(meetingDbId);

                socket.to(roomId).emit("meeting-ended", { message: "The host ended the meeting.", endedByHost: true });
                io.in(roomId).socketsLeave(roomId);
                clearTimeout(rooms.get(roomId)?.emptyTimer);
                rooms.delete(roomId);
                currentRoomId = null;
                currentMeeting = null;
            } catch (err) {
                console.error("Error ending meeting:", err);
            }
        })

        socket.on('leave-room', leaveCurrentRoom)

        // Handle Disconnect (Reloading window, network drop, or closing tab)
        socket.on('disconnect', leaveCurrentRoom)
    })
}
