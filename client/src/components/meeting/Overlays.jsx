import { memo } from 'react'

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

// Emoji reactions float up from the bottom of the stage with the sender's name.
export const ReactionsLayer = memo(({ reactions }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0" aria-live="polite">
    {reactions.map((r) => {
      const left = 8 + (Math.abs(hash(r.id)) % 30);
      return (
        <span key={r.id} className="absolute bottom-4 flex flex-col items-center" style={{ left: `${left}%`, animation: 'float-up 3.2s var(--ease-out) both' }}>
          <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
          <span className="mt-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{r.userName.split(' ')[0]}</span>
        </span>
      );
    })}
  </div>
));

// Live captions: the latest line from up to two speakers, newest at the bottom.
export const CaptionsLayer = memo(({ captions, on }) => {
  const lines = Object.entries(captions).sort((a, b) => a[1].at - b[1].at).slice(-2);
  if (!on && lines.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4" aria-live="polite">
      <div className="flex max-w-3xl flex-col items-center gap-1.5">
        {lines.length === 0 ? (
          <p className="rounded-xl bg-black/65 px-3.5 py-2 text-[13px] text-white/80 backdrop-blur-md">Captions are on. Speak and your words appear here for everyone.</p>
        ) : lines.map(([id, c]) => (
          <p key={id} className="rounded-xl bg-black/70 px-4 py-2 text-center text-[15px] leading-snug text-white backdrop-blur-md sm:text-[16px]">
            <span className="font-semibold text-emerald-300">{c.userName}: </span>
            <span className={c.final ? '' : 'opacity-85'}>{c.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
});
