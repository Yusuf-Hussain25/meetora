import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { socket } from "../config/socket";
import { ICE_CONFIG } from "../lib/ice";

const REACTION_MS = 3200;
const CAPTION_IDLE_MS = 5000;

// Everything that happens inside a live meeting: signaling and peer connections (one per
// participant, full mesh), screen sharing, chat, reactions, raised hands, captions and host controls.
//
// media: the useLocalMedia() object. Its tracks ref is read whenever a peer needs our tracks.
export const useMeeting = ({ roomId, joined, media, onMessage }) => {
    const [status, setStatus] = useState("idle"); // idle | connecting | live | ended
    const [meeting, setMeeting] = useState(null); // { title, hostId, startedAt }
    const [self, setSelf] = useState(null);
    const [remotes, setRemotes] = useState([]);
    const [messages, setMessages] = useState([]);
    const [reactions, setReactions] = useState([]);
    const [captions, setCaptions] = useState({});
    const [handRaised, setHandRaised] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [endInfo, setEndInfo] = useState(null);

    const peers = useRef(new Map()); // socketId -> { pc, senders: {audio, video}, pending: [], stream }
    const screenTrack = useRef(null);
    const msid = useRef(null);
    const mediaRef = useRef(media);
    const onMessageRef = useRef(onMessage);
    const remotesRef = useRef(remotes);
    const handRef = useRef(false);

    useEffect(() => {
        mediaRef.current = media;
        onMessageRef.current = onMessage;
        remotesRef.current = remotes;
    });

    const outgoing = (kind) => (kind === "video" ? screenTrack.current || mediaRef.current.tracks.current.video : mediaRef.current.tracks.current.audio);

    const updateRemote = (socketId, patch) =>
        setRemotes((prev) => prev.map((r) => (r.socketId === socketId ? { ...r, ...patch } : r)));

    const upsertRemote = (user) =>
        setRemotes((prev) => (prev.some((r) => r.socketId === user.socketId)
            ? prev.map((r) => (r.socketId === user.socketId ? { ...r, ...user } : r))
            : [...prev, { stream: null, connection: "new", ...user }]));

    const closePeer = (socketId) => {
        const entry = peers.current.get(socketId);
        if (entry) {
            entry.pc.close();
            peers.current.delete(socketId);
        }
    };

    const closeAll = () => {
        peers.current.forEach((entry) => entry.pc.close());
        peers.current.clear();
    };

    // Swap a local track on every connection (camera on/off, device switch). No renegotiation needed.
    const syncTrack = useCallback((kind, track) => {
        if (kind === "video" && screenTrack.current) return; // the screen is being sent instead
        peers.current.forEach((entry) => entry.senders[kind]?.replaceTrack(track).catch(() => {}));
    }, []);

    const createPeer = (remote, initiator) => {
        const pc = new RTCPeerConnection(ICE_CONFIG);
        const entry = { pc, senders: {}, pending: [], stream: null, initiator };
        peers.current.set(remote.socketId, entry);
        if (!msid.current) msid.current = new MediaStream();

        pc.onicecandidate = (e) => {
            if (e.candidate) socket.emit("ice-candidate", { targetSocketId: remote.socketId, candidate: e.candidate });
        };
        pc.ontrack = (e) => {
            const others = entry.stream ? entry.stream.getTracks().filter((t) => t.kind !== e.track.kind) : [];
            entry.stream = new MediaStream([...others, e.track]);
            updateRemote(remote.socketId, { stream: entry.stream });
        };
        pc.onconnectionstatechange = () => {
            updateRemote(remote.socketId, { connection: pc.connectionState });
            // The side that made the offer retries with an ICE restart if the path drops
            if (pc.connectionState === "failed" && entry.initiator) {
                pc.createOffer({ iceRestart: true })
                    .then((offer) => pc.setLocalDescription(offer))
                    .then(() => socket.emit("offer", { targetSocketId: remote.socketId, sdp: pc.localDescription }))
                    .catch(() => {});
            }
        };

        if (initiator) {
            // Always send one audio and one video slot, even without a track, so a camera or
            // screen share can be added later with replaceTrack instead of renegotiating.
            ["audio", "video"].forEach((kind) => {
                const t = pc.addTransceiver(outgoing(kind) || kind, { direction: "sendrecv", streams: [msid.current] });
                entry.senders[kind] = t.sender;
            });
        }
        return entry;
    };

    const flushCandidates = async (entry) => {
        const queued = entry.pending.splice(0);
        for (const c of queued) await entry.pc.addIceCandidate(c).catch(() => {});
    };

    const cleanupCall = useCallback(() => {
        closeAll();
        screenTrack.current?.stop();
        screenTrack.current = null;
        setScreenStream(null);
    }, []);

    // ------------------------------------------------------------------ socket wiring
    useEffect(() => {
        if (!joined || !roomId) return;
        // `joined` is an attempt counter, so a rejoin starts from a clean slate
        setStatus("connecting");
        setEndInfo(null);
        setRemotes([]);
        setCaptions({});
        handRef.current = false;
        setHandRaised(false);
        let firstConnect = true;
        const m = () => mediaRef.current;

        const join = () => socket.emit("join-room", { roomId, audioEnabled: m().audioEnabled, videoEnabled: m().videoEnabled });

        const handlers = {
            connect: () => {
                // After a dropped connection the server sees a new socket: rebuild the call
                if (!firstConnect) {
                    closeAll();
                    setRemotes([]);
                }
                firstConnect = false;
                join();
            },
            connect_error: (err) => {
                if (err.message === "unauthorized") {
                    setEndInfo({ message: "Your session expired. Sign in again to join." });
                    setStatus("ended");
                }
            },
            "room-state": ({ meeting: info, self: me, messages: history }) => {
                setMeeting(info);
                setSelf(me);
                setMessages(history);
                setStatus("live");
            },
            "all-users": (existing) => {
                existing.forEach(async (user) => {
                    upsertRemote(user);
                    const entry = createPeer(user, true);
                    try {
                        const offer = await entry.pc.createOffer();
                        await entry.pc.setLocalDescription(offer);
                        socket.emit("offer", { targetSocketId: user.socketId, sdp: entry.pc.localDescription });
                    } catch (err) {
                        console.error("offer failed", err);
                    }
                });
            },
            "user-joined": (user) => {
                upsertRemote(user);
                toast(`${user.userName} joined`, { icon: "👋", id: `join-${user.socketId}` });
            },
            offer: async ({ callerSocketId, sdp, callerUser }) => {
                if (callerUser) upsertRemote(callerUser);
                const entry = peers.current.get(callerSocketId) || createPeer(callerUser || { socketId: callerSocketId }, false);
                try {
                    await entry.pc.setRemoteDescription(sdp);
                    if (!entry.senders.audio) {
                        // Answerer: reuse the transceivers the offer created, attaching our tracks
                        for (const t of entry.pc.getTransceivers()) {
                            const kind = t.receiver.track.kind;
                            t.direction = "sendrecv";
                            await t.sender.replaceTrack(outgoing(kind) || null);
                            t.sender.setStreams?.(msid.current);
                            entry.senders[kind] = t.sender;
                        }
                    }
                    await flushCandidates(entry);
                    const answer = await entry.pc.createAnswer();
                    await entry.pc.setLocalDescription(answer);
                    socket.emit("answer", { targetSocketId: callerSocketId, sdp: entry.pc.localDescription });
                } catch (err) {
                    console.error("answer failed", err);
                }
            },
            answer: async ({ responderSocketId, sdp }) => {
                const entry = peers.current.get(responderSocketId);
                if (!entry) return;
                try {
                    await entry.pc.setRemoteDescription(sdp);
                    await flushCandidates(entry);
                } catch (err) {
                    console.error("set answer failed", err);
                }
            },
            // Candidates can arrive before the offer/answer is applied: queue them until then
            "ice-candidate": async ({ senderSocketId, candidate }) => {
                const entry = peers.current.get(senderSocketId);
                if (!entry || !candidate) return;
                if (entry.pc.remoteDescription) await entry.pc.addIceCandidate(candidate).catch(() => {});
                else entry.pending.push(candidate);
            },
            "user-toggled-audio": ({ socketId, audioEnabled }) => updateRemote(socketId, { audioEnabled }),
            "user-toggled-video": ({ socketId, videoEnabled }) => updateRemote(socketId, { videoEnabled }),
            "user-screen": ({ socketId, screenSharing }) => updateRemote(socketId, { screenSharing }),
            "user-hand": ({ socketId, handRaised: raised }) => {
                updateRemote(socketId, { handRaised: raised });
                const who = remotesRef.current.find((r) => r.socketId === socketId);
                if (raised && who) toast(`${who.userName} raised their hand`, { icon: "✋", id: `hand-${socketId}` });
            },
            "user-left": ({ socketId, user }) => {
                closePeer(socketId);
                setRemotes((prev) => prev.filter((r) => r.socketId !== socketId));
                setCaptions((prev) => {
                    const next = { ...prev };
                    delete next[socketId];
                    return next;
                });
                if (user?.userName) toast(`${user.userName} left`, { id: `left-${socketId}` });
            },
            reaction: (r) => {
                setReactions((prev) => [...prev.slice(-30), r]);
                setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), REACTION_MS);
            },
            caption: (c) => {
                setCaptions((prev) => ({ ...prev, [c.socketId]: { userName: c.userName, text: c.text, final: c.final, at: Date.now() } }));
            },
            "receive-message": (msg) => {
                setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
                onMessageRef.current?.(msg);
            },
            "force-mute": ({ by }) => {
                m().setMuted(true);
                socket.emit("toggle-audio", { audioEnabled: false });
                toast(`${by} muted you`, { icon: "🔇" });
            },
            "meeting-ended": (info) => {
                cleanupCall();
                setEndInfo(info);
                setStatus("ended");
            },
        };

        Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));
        if (socket.connected) handlers.connect();
        else socket.connect();

        return () => {
            Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
            socket.emit("leave-room");
            socket.disconnect();
            cleanupCall();
        };
    }, [joined, roomId, cleanupCall]); // eslint-disable-line react-hooks/exhaustive-deps -- helpers only touch refs and setters

    // Tell the room when our mic or camera changes
    useEffect(() => {
        if (status === "live") socket.emit("toggle-audio", { audioEnabled: media.audioEnabled });
    }, [media.audioEnabled, status]);
    useEffect(() => {
        if (status === "live") socket.emit("toggle-video", { videoEnabled: media.videoEnabled });
    }, [media.videoEnabled, status]);

    // Captions fade out after a few seconds of silence
    useEffect(() => {
        const id = setInterval(() => {
            setCaptions((prev) => {
                const now = Date.now();
                const entries = Object.entries(prev).filter(([, c]) => now - c.at < CAPTION_IDLE_MS);
                return entries.length === Object.keys(prev).length ? prev : Object.fromEntries(entries);
            });
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // ------------------------------------------------------------------ actions
    const sendMessage = useCallback((text) => {
        const clean = text.trim();
        if (!clean) return;
        socket.emit("send-message", { message: { text: clean, clientId: `${Date.now()}` } });
    }, []);

    const sendReaction = useCallback((emoji) => socket.emit("reaction", { emoji }), []);

    const toggleHand = useCallback(() => {
        handRef.current = !handRef.current;
        setHandRaised(handRef.current);
        socket.emit("raise-hand", { raised: handRef.current });
    }, []);

    const sendCaption = useCallback((text, final, lineId) => {
        socket.emit("caption", { text, final, lineId });
        setCaptions((prev) => ({ ...prev, self: { userName: "You", text, final, at: Date.now() } }));
    }, []);

    const stopShare = useCallback(() => {
        const track = screenTrack.current;
        if (!track) return;
        track.onended = null;
        track.stop();
        screenTrack.current = null;
        setScreenStream(null);
        const camera = mediaRef.current.tracks.current.video;
        peers.current.forEach((entry) => entry.senders.video?.replaceTrack(camera || null).catch(() => {}));
        socket.emit("screen-share", { sharing: false });
    }, []);

    const startShare = useCallback(async () => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            toast.error("Screen sharing isn't supported in this browser");
            return;
        }
        try {
            const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
            const track = display.getVideoTracks()[0];
            track.contentHint = "detail";
            screenTrack.current = track;
            setScreenStream(display);
            peers.current.forEach((entry) => entry.senders.video?.replaceTrack(track).catch(() => {}));
            socket.emit("screen-share", { sharing: true });
            track.onended = stopShare; // "Stop sharing" in the browser bar
        } catch (err) {
            if (err.name !== "NotAllowedError") toast.error("Couldn't start screen sharing");
        }
    }, [stopShare]);

    const leave = useCallback(() => {
        socket.emit("leave-room");
        cleanupCall();
        setStatus("ended");
        setEndInfo({ left: true });
    }, [cleanupCall]);

    const endForAll = useCallback(() => {
        socket.emit("end-meeting");
        cleanupCall();
        setStatus("ended");
        setEndInfo({ endedByYou: true });
    }, [cleanupCall]);

    const hostMute = useCallback((socketId) => socket.emit("host-mute", { targetSocketId: socketId }), []);
    const hostMuteAll = useCallback(() => socket.emit("host-mute-all"), []);
    const hostRemove = useCallback((socketId) => socket.emit("host-remove", { targetSocketId: socketId }), []);

    return {
        status, meeting, self, remotes, messages, reactions, captions, handRaised, screenStream, endInfo,
        isHost: Boolean(self?.isHost),
        syncTrack, sendMessage, sendReaction, toggleHand, sendCaption, startShare, stopShare, leave, endForAll,
        hostMute, hostMuteAll, hostRemove,
    };
};
