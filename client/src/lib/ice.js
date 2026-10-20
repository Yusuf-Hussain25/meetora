// STUN/TURN servers for WebRTC. STUN is enough on most networks; for strict corporate or
// mobile networks add a TURN server through VITE_ICE_SERVERS, e.g.
// VITE_ICE_SERVERS='[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]'
const DEFAULT_ICE = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

const parseExtra = () => {
    const raw = import.meta.env.VITE_ICE_SERVERS;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.warn("VITE_ICE_SERVERS is not valid JSON; using STUN only");
        return [];
    }
};

export const ICE_CONFIG = { iceServers: [...DEFAULT_ICE, ...parseExtra()] };
