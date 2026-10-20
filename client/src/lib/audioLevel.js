// Microphone / remote audio level metering with one shared AudioContext.
let ctx = null;

const getContext = () => {
    if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
};

// Calls onLevel(0..1) every `interval` ms for the stream's audio. Returns a stop function.
export const watchLevel = (stream, onLevel, interval = 120) => {
    const audioCtx = getContext();
    const track = stream?.getAudioTracks?.()[0];
    if (!audioCtx || !track || track.readyState === "ended") return () => {};

    const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const id = setInterval(() => {
        if (!track.enabled) return onLevel(0);
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) {
            const x = (v - 128) / 128;
            sum += x * x;
        }
        onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
    }, interval);

    return () => {
        clearInterval(id);
        source.disconnect();
    };
};
