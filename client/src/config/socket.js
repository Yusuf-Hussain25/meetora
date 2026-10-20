import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

export const socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    // The server verifies this Clerk session token on every (re)connect
    auth: async (cb) => {
        try {
            cb({ token: await window.Clerk?.session?.getToken() });
        } catch {
            cb({});
        }
    },
})
