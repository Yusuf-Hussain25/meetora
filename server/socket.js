import { verifyToken } from "@clerk/backend";
import { sql } from "./config/db.js";
import { ensureUser } from "./lib/users.js";

const MAX_MESSAGE_LENGTH = 2000;

// Socket.IO Room State: roomId -> Map<socketId, participantObject>
const rooms = new Map();

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

        const isInRoom = (socketId) => Boolean(currentRoomId && rooms.get(currentRoomId)?.has(socketId));

        // Marks this user as gone from the meeting once their last socket in the room leaves
        const markLeft = async (roomId, meetingDbId) => {
            const stillHere = Array.from(rooms.get(roomId)?.values() || []).some((p) => p.userId === authUser.id);
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
            const roomParticipants = rooms.get(roomId);

            socket.leave(roomId);
            currentRoomId = null;
            currentMeeting = null;

            if (roomParticipants) {
                roomParticipants.delete(socket.id);
                if (roomParticipants.size === 0) {
                    rooms.delete(roomId);
                } else {
                    // Notify remaining peers that a user disconnected
                    socket.to(roomId).emit("user-left", { socketId: socket.id, user: currentUser });
                }
            }
            if (meeting) await markLeft(roomId, meeting.id);
        };

        // User joins a meeting room
        socket.on("join-room", async ({roomId, audioEnabled = true, videoEnabled = true}) => {
            try {
                if (typeof roomId !== "string") return;
                if (currentRoomId) await leaveCurrentRoom();

                // Verify meeting status from DB
                const meetings = await sql`SELECT id, host_id, status FROM meetings WHERE meeting_id = ${roomId}`;

                if (meetings.length === 0){
                    socket.emit("meeting-ended", {message: "Meeting not found."})
                    return;
                }
                const meeting = meetings[0];

                if (meeting.status === "ended"){
                    socket.emit("meeting-ended", {message: "This meeting has already ended."})
                    return;
                }

                if(!rooms.has(roomId)){
                    rooms.set(roomId, new Map())
                }
                const roomParticipants = rooms.get(roomId);

                // Fetch host plan to enforce participant limits (10 for Free, 100 for Premium)
                const hosts = await sql`SELECT plan FROM users WHERE id = ${meeting.host_id}`;
                const hostPlan = hosts[0]?.plan || "free";
                const maxParticipants = hostPlan === "premium" ? 100 : 10;

                if (roomParticipants.size >= maxParticipants){
                    socket.emit("meeting-ended", {
                        message: `Meeting capacity limit reached (max ${maxParticipants} participants for ${hostPlan.toUpperCase()} plan). Host must upgrade to Premium for up to 100 participants!`,
                    })
                    return;
                }

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
                }

                socket.join(roomId)

                // Get existing participants in the room, then add the newcomer
                const existingUsers = Array.from(roomParticipants.values());
                roomParticipants.set(socket.id, currentUser);

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

        socket.on('toggle-audio', ({ audioEnabled })=>{
            if (!currentRoomId) return;
            currentUser.audioEnabled = Boolean(audioEnabled);
            socket.to(currentRoomId).emit('user-toggled-audio', {
                socketId: socket.id,
                audioEnabled: currentUser.audioEnabled,
            })
        })

        socket.on('toggle-video', ({ videoEnabled })=>{
            if (!currentRoomId) return;
            currentUser.videoEnabled = Boolean(videoEnabled);
            socket.to(currentRoomId).emit('user-toggled-video', {
                socketId: socket.id,
                videoEnabled: currentUser.videoEnabled,
            })
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
                    senderId: authUser.id,
                    senderName: authUser.name,
                    senderSocketId: socket.id,
                    text,
                    timestamp: saved.timestamp,
                })
            } catch (err) {
                console.error("Error saving chat message to DB:", err);
            }
        })

        // Only the host can end the meeting for everyone
        socket.on('end-meeting', async ()=>{
            try {
                if (!currentRoomId || !currentMeeting || currentMeeting.hostId !== authUser.id) return;
                const roomId = currentRoomId;
                const meetingDbId = currentMeeting.id;

                await sql`
                    UPDATE meetings SET status = 'ended', ended_at = NOW(), updated_at = NOW()
                    WHERE id = ${meetingDbId}`;
                await sql`
                    UPDATE meeting_participants SET left_at = NOW()
                    WHERE meeting_id = ${meetingDbId} AND left_at IS NULL`;

                socket.to(roomId).emit("meeting-ended", { message: "The meeting has been ended by the host." });
                io.in(roomId).socketsLeave(roomId);
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
