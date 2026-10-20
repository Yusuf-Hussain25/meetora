import { useEffect, useState } from "react";
import api from "../config/api";

let cached = null; // one request per page load

// { enabled, provider, model } from the server, or null while loading
export const useAiStatus = () => {
    const [status, setStatus] = useState(null);
    useEffect(() => {
        cached ??= api.get("/api/ai/status").then(({ data }) => data).catch(() => ({ enabled: false }));
        let alive = true;
        cached.then((s) => alive && setStatus(s));
        return () => { alive = false; };
    }, []);
    return status;
};
