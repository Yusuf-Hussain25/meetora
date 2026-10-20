import { memo, useEffect, useRef, useState } from 'react'
import { CrownIcon, HandIcon, MicIcon, MicOffIcon, MonitorUpIcon, MoreHorizontalIcon, PinIcon, PinOffIcon, UserMinusIcon, WifiOffIcon } from 'lucide-react'
import Avatar from '../ui/Avatar'

const AVATAR = { lg: 112, md: 84, sm: 44 };

// One participant: their video (always mounted so audio keeps playing), or an avatar when the
// camera is off, with name, mic state, raised hand, speaking glow and pin / host controls.
const VideoTile = ({ p, speaking = false, size = 'md', pinned = false, onPin, sinkId, mirror = true, hostActions, className = '', style }) => {
  const videoRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== p.stream) el.srcObject = p.stream || null;
    // A tile can remount when the layout changes; start playback explicitly
    if (p.stream) el.play?.().catch(() => {});
  }, [p.stream]);

  useEffect(() => {
    if (sinkId && videoRef.current?.setSinkId) videoRef.current.setSinkId(sinkId).catch(() => {});
  }, [sinkId]);

  const hasVideo = Boolean(p.stream?.getVideoTracks().length);
  const showVideo = hasVideo && (p.videoEnabled || p.screenSharing);
  const reconnecting = !p.isLocal && (p.connection === 'disconnected' || p.connection === 'failed');
  const connecting = !p.isLocal && !p.stream && p.connection !== 'connected';

  return (
    <div
      className={`group relative overflow-hidden rounded-[20px] bg-tile transition-shadow duration-300 ${speaking ? 'shadow-[0_0_0_3px_var(--accent),0_0_36px_rgba(16,185,129,.35)]' : 'shadow-[0_0_0_1px_var(--border)]'} ${className}`}
      style={style}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={p.isLocal}
        className={`absolute inset-0 size-full transition-opacity duration-300 ${p.screenSharing ? 'bg-black object-contain' : 'object-cover'} ${mirror && p.isLocal && !p.screenSharing ? '-scale-x-100' : ''} ${showVideo ? 'opacity-100' : 'opacity-0'}`}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-2 to-transparent">
          <span className={`rounded-full ${speaking ? 'animate-[pulse-ring_1.2s_ease-out_infinite]' : ''}`}>
            <Avatar src={p.image} name={p.name} size={AVATAR[size]} />
          </span>
        </div>
      )}

      {/* top-left status */}
      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        {p.handRaised && (
          <span className="flex h-7 items-center gap-1 rounded-full bg-hand px-2.5 text-[12px] font-semibold text-black shadow-md animate-pop-in">
            <HandIcon size={14} /> {size !== 'sm' && 'Hand raised'}
          </span>
        )}
        {(connecting || reconnecting) && (
          <span className="flex h-7 items-center gap-1.5 rounded-full bg-black/60 px-2.5 text-[12px] font-medium text-white backdrop-blur">
            {reconnecting ? <WifiOffIcon size={13} /> : <span className="spinner size-3" />}
            {size !== 'sm' && (reconnecting ? 'Reconnecting' : 'Connecting')}
          </span>
        )}
      </div>

      {/* top-right actions (hover / focus) */}
      {(onPin || hostActions) && (
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          {onPin && (
            <button className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75" onClick={onPin} aria-label={pinned ? `Unpin ${p.name}` : `Pin ${p.name}`}>
              {pinned ? <PinOffIcon size={15} /> : <PinIcon size={15} />}
            </button>
          )}
          {hostActions && (
            <div className="relative">
              <button className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75" onClick={() => setMenuOpen((o) => !o)} aria-label={`Host options for ${p.name}`} aria-expanded={menuOpen}>
                <MoreHorizontalIcon size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-line-strong bg-panel-solid p-1 text-sm shadow-deep animate-pop-in" onMouseLeave={() => setMenuOpen(false)}>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-50" disabled={!p.audioEnabled} onClick={() => { hostActions.onMute(); setMenuOpen(false); }}>
                    <MicOffIcon size={15} /> Ask to mute
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-danger hover:bg-surface-2" onClick={() => { hostActions.onRemove(); setMenuOpen(false); }}>
                    <UserMinusIcon size={15} /> Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* name bar */}
      <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-black/55 px-2 py-1 text-[12px] font-medium text-white backdrop-blur-md">
          {p.audioEnabled ? <MicIcon size={12} className={speaking ? 'text-emerald-300' : ''} /> : <MicOffIcon size={12} className="text-rose-300" />}
          <span className="truncate">{p.name}</span>
          {p.isHost && size !== 'sm' && <CrownIcon size={12} className="shrink-0 text-amber-300" aria-label="Host" />}
        </span>
        {p.screenSharing && size !== 'sm' && (
          <span className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-[11px] font-semibold text-[var(--accent-ink)]">
            <MonitorUpIcon size={12} /> Presenting
          </span>
        )}
      </div>
    </div>
  );
};

export default memo(VideoTile)
