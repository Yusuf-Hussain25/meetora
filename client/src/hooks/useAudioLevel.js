import { useEffect, useState } from "react";
import { watchLevel } from "../lib/audioLevel";

const SPEAKING_LEVEL = 0.08;
const REMOTE_SPEAKING_LEVEL = 0.03; // RTP audioLevel, linear 0..1
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

// Set of ids currently speaking. Holds briefly so the glow doesn't flicker.
// entries: [{ id, stream }] measured with Web Audio (our own mic), or [{ id, level: () => 0..1 }]
// read from the WebRTC receiver for remote people.
export const useSpeakers = (entries) => {
    const [speaking, setSpeaking] = useState(() => new Set());
    const key = entries.map((e) => `${e.id}:${e.level ? "rtp" : trackKey(e.stream)}`).join("|");

    useEffect(() => {
        const lastLoud = new Map();
        const stops = entries.filter((e) => !e.level).map(({ id, stream }) =>
            watchLevel(stream, (level) => {
                if (level > SPEAKING_LEVEL) lastLoud.set(id, Date.now());
            })
        );
        const polled = entries.filter((e) => e.level);
        const tick = setInterval(() => {
            const now = Date.now();
            polled.forEach(({ id, level }) => {
                if (level() > REMOTE_SPEAKING_LEVEL) lastLoud.set(id, now);
            });
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
