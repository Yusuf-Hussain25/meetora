// In-memory state of live meetings, shared by the socket server and the REST API.
// roomId -> { participants: Map<socketId, participant>, removed: Set<userId>, emptyTimer }
export const rooms = new Map();

export const getRoom = (roomId, create = false) => {
    if (!rooms.has(roomId) && create) {
        rooms.set(roomId, { participants: new Map(), removed: new Set(), emptyTimer: null });
    }
    return rooms.get(roomId);
};

// People currently connected to a meeting, one entry per user (a user may have two tabs open)
export const liveParticipants = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return [];
    const byUser = new Map();
    for (const p of room.participants.values()) byUser.set(p.userId, p);
    return Array.from(byUser.values()).map((p) => ({ id: p.userId, name: p.userName, image: p.image }));
};
