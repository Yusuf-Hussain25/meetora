import { useState } from 'react'
import { gradientFor, initialsOf } from '../../lib/avatar'

// Profile picture with an initials fallback and an optional presence dot.
const Avatar = ({ src, name = '', size = 40, online = false, ring = false, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${ring ? 'ring-2 ring-bg outline-2 outline-accent' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {showImage
        ? <img src={src} alt={name} onError={() => setFailed(true)} loading="lazy" className="size-full rounded-full object-cover" />
        : (
          <span
            className="grid size-full place-items-center rounded-full font-semibold text-white select-none"
            style={{ background: gradientFor(name), letterSpacing: '-0.02em' }}
            aria-label={name || undefined}
          >
            {initialsOf(name)}
          </span>
        )}
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-bg bg-ok"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      )}
    </span>
  );
};

// Overlapping row of avatars with a "+N" counter.
export const AvatarStack = ({ people = [], max = 4, size = 28 }) => {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id || p.name || i} className="rounded-full border-2 border-panel-solid" style={{ marginLeft: i ? -size * 0.32 : 0 }}>
          <Avatar src={p.image} name={p.name} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="grid place-items-center rounded-full border-2 border-panel-solid bg-surface-3 text-[11px] font-semibold text-fg-2"
          style={{ width: size + 4, height: size + 4, marginLeft: -size * 0.32 }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
};

export default Avatar
