import { useEffect, useState } from "react";
import { watchLevel } from "../lib/audioLevel";

const SPEAKING_LEVEL = 0.12;
const HOLD_MS = 700;

const trackKey = (stream) => stream?.getAudioTracks?.()[0]?.id || "";

// Live 0..1 level of one stream's audio (the lobby mic meter).
export const useAudioLevel = (stream) => {
    const [level, setLevel] = useState(0);
    const key = trackKey(stream);
    useEffect(() => {
        if (!key) return;
        const stop = watchLevel(stream, setLevel, 90);
        return () => {
            stop();
            setLevel(0);
        };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- re-run only when the audio track changes
    return level;
};

// Set of ids currently speaking, from [{ id, stream }]. Holds briefly so the glow doesn't flicker.
export const useSpeakers = (entries) => {
    const [speaking, setSpeaking] = useState(() => new Set());
    const key = entries.map((e) => `${e.id}:${trackKey(e.stream)}`).join("|");

    useEffect(() => {
        const lastLoud = new Map();
        const stops = entries.map(({ id, stream }) =>
            watchLevel(stream, (level) => {
                if (level > SPEAKING_LEVEL) lastLoud.set(id, Date.now());
            })
        );
        const tick = setInterval(() => {
            const now = Date.now();
            const next = new Set([...lastLoud].filter(([, t]) => now - t < HOLD_MS).map(([id]) => id));
            setSpeaking((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next));
        }, 200);
        return () => {
            stops.forEach((stop) => stop());
            clearInterval(tick);
        };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` captures the streams that matter

    return speaking;
};
