import { useEffect, useRef, useState } from "react";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const captionsSupported = Boolean(Recognition);

// Turns your own speech into captions with the browser's speech recognition (Chrome, Edge, Safari).
// Runs only while captions are on AND your mic is unmuted, so muted speech is never transcribed.
// onResult(text, isFinal, lineId) gets interim text (throttled) and each finished sentence.
export const useLiveCaptions = ({ enabled, micOn, onResult }) => {
    const [error, setError] = useState(null);
    const onResultRef = useRef(onResult);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        if (!Recognition || !enabled || !micOn) return;
        const rec = new Recognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || "en-US";

        let stopped = false;
        let lineId = `${Date.now()}`;
        let lastInterim = 0;

        rec.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const result = e.results[i];
                const text = result[0].transcript.trim();
                if (!text) continue;
                if (result.isFinal) {
                    onResultRef.current?.(text, true, lineId);
                    lineId = `${Date.now()}-${i}`;
                } else if (Date.now() - lastInterim > 250) {
                    lastInterim = Date.now();
                    onResultRef.current?.(text, false, lineId);
                }
            }
        };
        rec.onerror = (e) => {
            if (e.error === "not-allowed" || e.error === "service-not-allowed") {
                stopped = true;
                setError("Captions need microphone permission and an internet connection.");
            }
        };
        // Recognition stops itself after silence; keep it running while captions are on
        rec.onend = () => {
            if (!stopped) {
                try {
                    rec.start();
                } catch {
                    // already restarting
                }
            }
        };
        try {
            rec.start();
            setError(null);
        } catch {
            // start() throws if called twice; the onend handler covers restarts
        }

        return () => {
            stopped = true;
            rec.onend = null;
            rec.abort();
        };
    }, [enabled, micOn]);

    return { supported: captionsSupported, error };
};
