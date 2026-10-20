import { useEffect, useState } from 'react'
import { CaptionsIcon, HandIcon, MessageSquareIcon, MicIcon, MicOffIcon, MonitorUpIcon, PhoneOffIcon, VideoIcon } from 'lucide-react'
import { LogoMark } from '../ui/Logo'

const PEOPLE = [
  { name: 'Aisha Khan', img: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { name: 'Rohan Mehta', img: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { name: 'Lena Fischer', img: 'https://randomuser.me/api/portraits/women/44.jpg', muted: true },
  { name: 'Diego Alvarez', img: 'https://randomuser.me/api/portraits/men/75.jpg', hand: true },
];

const CAPTIONS = [
  [0, 'Okay, the new onboarding flow is live for 10% of users.'],
  [1, 'Activation is already up four points since Monday.'],
  [3, 'Can we ship the same flow to the mobile app next sprint?'],
  [0, "Yes, let's put it on the roadmap and review on Friday."],
];

const REACTIONS = ['🎉', '👏', '🔥', '💚'];

// Animated mock of a live Meetora call for the auth page hero.
const CallPreview = () => {
  const [step, setStep] = useState(0);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setStep((s) => s + 1), 2600);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const [speaker, line] = CAPTIONS[step % CAPTIONS.length];

  return (
    <div className="card relative overflow-hidden p-3 shadow-deep" aria-hidden="true">
      {/* window bar */}
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <div className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <span className="text-[13px] font-semibold">Product weekly</span>
          <span className="chip h-6 font-mono text-[11px]"><span className="size-1.5 rounded-full bg-danger animate-pulse" />24:13</span>
        </div>
        <span className="chip chip-accent h-6 text-[11px]"><CaptionsIcon size={12} /> Captions on</span>
      </div>

      {/* tiles */}
      <div className="grid grid-cols-2 gap-2">
        {PEOPLE.map((p, i) => {
          const speaking = i === speaker;
          return (
            <div
              key={p.name}
              className={`relative aspect-video overflow-hidden rounded-2xl bg-tile transition-shadow duration-500 ${speaking ? 'shadow-[0_0_0_2px_var(--accent),0_0_30px_rgba(16,185,129,.35)]' : ''}`}
            >
              <img src={p.img} alt="" className="size-full object-cover opacity-90" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              {p.hand && (
                <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-hand text-black shadow-md animate-bounce">
                  <HandIcon size={14} />
                </span>
              )}
              <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                {p.muted ? <MicOffIcon size={11} className="text-rose-300" /> : <MicIcon size={11} />}
                {p.name.split(' ')[0]}
              </span>
              {speaking && (
                <span className="absolute bottom-2 right-2 flex h-4 items-end gap-[2px]">
                  {[0, 1, 2].map((b) => (
                    <span key={b} className="w-[3px] rounded-full bg-accent" style={{ height: `${[9, 14, 7][b]}px`, animation: `pulse 0.${6 + b}s ease-in-out infinite alternate` }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* floating reactions */}
      <div className="pointer-events-none absolute bottom-28 right-10 h-0 w-0">
        {!reduceMotion && REACTIONS.map((r, i) => (
          <span
            key={`${r}-${step}`}
            className="absolute text-2xl"
            style={{ left: (i % 2) * 22 - 10, animation: `float-up 2.6s ${i * 0.35}s var(--ease-out) both` }}
          >
            {r}
          </span>
        ))}
      </div>

      {/* live caption */}
      <div className="mx-auto my-3 min-h-[38px] w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-center text-[12.5px] leading-snug">
        <span className="font-semibold text-accent-text">{PEOPLE[speaker].name.split(' ')[0]}: </span>
        <span key={step} className="animate-fade-up inline-block">{line}</span>
      </div>

      {/* control bar */}
      <div className="flex items-center justify-center gap-2 pb-1">
        {[MicIcon, VideoIcon, MonitorUpIcon, HandIcon, MessageSquareIcon].map((Icon, i) => (
          <span key={i} className={`grid size-9 place-items-center rounded-xl border border-line ${i === 2 ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-fg-2'}`}>
            <Icon size={16} />
          </span>
        ))}
        <span className="grid h-9 w-12 place-items-center rounded-xl bg-danger text-white"><PhoneOffIcon size={16} /></span>
      </div>
    </div>
  );
};

export default CallPreview
