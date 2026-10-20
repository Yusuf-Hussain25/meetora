import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const PREFS_KEY = "meetora-devices";

const loadPrefs = () => {
    try {
        return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch {
        return {};
    }
};
const savePrefs = (prefs) => {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // storage unavailable: preferences just won't persist
    }
};

const audioConstraints = (deviceId, noiseSuppression) => ({
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression,
    autoGainControl: true,
});
const videoConstraints = (deviceId) => ({
    deviceId: deviceId ? { exact: deviceId } : undefined,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
});

const classify = (err) => {
    if (!err) return null;
    if (err.name === "NotAllowedError" || err.name === "SecurityError") return "denied";
    if (err.name === "NotReadableError" || err.name === "AbortError") return "inuse";
    return "notfound";
};

// Camera + microphone for the lobby and the call. Turning the camera off stops the track
// (so the camera light goes off); onTrackChange(kind, track) lets the call swap tracks on peers.
export const useLocalMedia = ({ onTrackChange } = {}) => {
    const prefs = useRef(loadPrefs());
    const tracks = useRef({ audio: null, video: null });
    const onTrackChangeRef = useRef(onTrackChange);
    const [stream, setStream] = useState(null);
    const [status, setStatus] = useState("idle"); // idle | requesting | ready
    const [error, setError] = useState(null); // denied | notfound | inuse | null
    const [audioEnabled, setAudioEnabled] = useState(prefs.current.audio ?? true);
    const [videoEnabled, setVideoEnabled] = useState(prefs.current.video ?? true);
    const [noiseSuppression, setNoiseSuppressionState] = useState(prefs.current.noiseSuppression ?? true);
    const [devices, setDevices] = useState({ audioinput: [], videoinput: [], audiooutput: [] });
    const [selected, setSelected] = useState({
        audioinput: prefs.current.audioinput || "",
        videoinput: prefs.current.videoinput || "",
        audiooutput: prefs.current.audiooutput || "",
    });
    const selectedRef = useRef(selected);

    useEffect(() => {
        onTrackChangeRef.current = onTrackChange;
    }, [onTrackChange]);

    useEffect(() => {
        selectedRef.current = selected;
        savePrefs({ ...prefs.current, ...selected, audio: audioEnabled, video: videoEnabled, noiseSuppression });
    }, [selected, audioEnabled, videoEnabled, noiseSuppression]);

    const publish = () => setStream(new MediaStream([tracks.current.audio, tracks.current.video].filter(Boolean)));
    const notify = (kind, track) => onTrackChangeRef.current?.(kind, track);

    const refreshDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const list = await navigator.mediaDevices.enumerateDevices();
        const grouped = { audioinput: [], videoinput: [], audiooutput: [] };
        list.forEach((d) => {
            if (grouped[d.kind] && d.deviceId) grouped[d.kind].push({ id: d.deviceId, label: d.label || `${d.kind} ${grouped[d.kind].length + 1}` });
        });
        setDevices(grouped);
    }, []);

    const getTrack = async (kind, deviceId) => {
        const constraints = kind === "audio"
            ? { audio: audioConstraints(deviceId, prefs.current.noiseSuppression ?? true) }
            : { video: videoConstraints(deviceId) };
        try {
            const s = await navigator.mediaDevices.getUserMedia(constraints);
            return s.getTracks()[0];
        } catch (err) {
            // A saved device may have been unplugged: fall back to the default one
            if (deviceId && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
                const s = await navigator.mediaDevices.getUserMedia(kind === "audio" ? { audio: true } : { video: true });
                return s.getTracks()[0];
            }
            throw err;
        }
    };

    // Ask for camera and mic. Works with one of them missing; with neither you can still join to listen and chat.
    const start = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("notfound");
            setStatus("ready");
            return;
        }
        setStatus("requesting");
        const { audioinput, videoinput } = selectedRef.current;
        let audio = null, video = null, firstError = null;
        try {
            audio = await getTrack("audio", audioinput);
        } catch (err) {
            firstError = err;
        }
        if (prefs.current.video ?? true) {
            try {
                video = await getTrack("video", videoinput);
            } catch (err) {
                firstError = firstError || err;
            }
        }
        if (audio) audio.enabled = prefs.current.audio ?? true;
        tracks.current = { audio, video };
        setAudioEnabled(Boolean(audio) && (prefs.current.audio ?? true));
        setVideoEnabled(Boolean(video));
        setError(!audio && !video ? classify(firstError) || "notfound" : !audio ? classify(firstError) : null);
        publish();
        setStatus("ready");
        refreshDevices();
    }, [refreshDevices]); // eslint-disable-line react-hooks/exhaustive-deps -- getTrack only reads refs

    const toggleAudio = useCallback(async () => {
        const track = tracks.current.audio;
        if (track) {
            track.enabled = !track.enabled;
            setAudioEnabled(track.enabled);
            return;
        }
        try {
            const fresh = await getTrack("audio", selectedRef.current.audioinput);
            tracks.current.audio = fresh;
            publish();
            notify("audio", fresh);
            setAudioEnabled(true);
            setError(null);
        } catch (err) {
            setError(classify(err));
            toast.error(classify(err) === "denied" ? "Microphone access is blocked in your browser settings" : "No microphone found");
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads refs only

    const setMuted = useCallback((muted) => {
        const track = tracks.current.audio;
        if (!track) return;
        track.enabled = !muted;
        setAudioEnabled(!muted);
    }, []);

    const toggleVideo = useCallback(async () => {
        const current = tracks.current.video;
        if (current) {
            current.stop();
            tracks.current.video = null;
            publish();
            notify("video", null);
            setVideoEnabled(false);
            prefs.current.video = false;
            return;
        }
        try {
            const fresh = await getTrack("video", selectedRef.current.videoinput);
            tracks.current.video = fresh;
            publish();
            notify("video", fresh);
            setVideoEnabled(true);
            prefs.current.video = true;
            refreshDevices();
        } catch (err) {
            toast.error(classify(err) === "denied" ? "Camera access is blocked in your browser settings" : classify(err) === "inuse" ? "Your camera is in use by another app" : "No camera found");
        }
    }, [refreshDevices]); // eslint-disable-line react-hooks/exhaustive-deps -- getTrack only reads refs

    const switchDevice = useCallback(async (kind, deviceId) => {
        setSelected((s) => ({ ...s, [kind]: deviceId }));
        selectedRef.current = { ...selectedRef.current, [kind]: deviceId };
        if (kind === "audiooutput") return;
        const type = kind === "audioinput" ? "audio" : "video";
        const old = tracks.current[type];
        if (type === "video" && !old) return; // camera is off: the new choice applies when it's turned on
        try {
            const fresh = await getTrack(type, deviceId);
            if (type === "audio" && old) fresh.enabled = old.enabled;
            tracks.current[type] = fresh;
            publish();
            notify(type, fresh);
            old?.stop();
        } catch {
            toast.error("Couldn't switch to that device");
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads refs only

    const setNoiseSuppression = useCallback(async (on) => {
        prefs.current.noiseSuppression = on;
        setNoiseSuppressionState(on);
        const old = tracks.current.audio;
        if (!old) return;
        try {
            const fresh = await getTrack("audio", selectedRef.current.audioinput);
            fresh.enabled = old.enabled;
            tracks.current.audio = fresh;
            publish();
            notify("audio", fresh);
            old.stop();
        } catch {
            toast.error("Couldn't update the microphone");
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads refs only

    const stopAll = useCallback(() => {
        tracks.current.audio?.stop();
        tracks.current.video?.stop();
        tracks.current = { audio: null, video: null };
        setStream(null);
    }, []);

    useEffect(() => {
        const md = navigator.mediaDevices;
        md?.addEventListener?.("devicechange", refreshDevices);
        return () => {
            md?.removeEventListener?.("devicechange", refreshDevices);
            tracks.current.audio?.stop();
            tracks.current.video?.stop();
        };
    }, [refreshDevices]);

    return {
        stream, tracks, status, error, devices, selected,
        audioEnabled, videoEnabled, noiseSuppression,
        start, stopAll, toggleAudio, toggleVideo, setMuted, switchDevice, setNoiseSuppression,
    };
};
