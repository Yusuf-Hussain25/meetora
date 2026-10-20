import { useEffect, useRef, useState } from 'react'
import {
  CaptionsIcon, CaptionsOffIcon, ChevronUpIcon, EllipsisIcon, HandIcon, KeyboardIcon, LayoutGridIcon, MessageSquareIcon,
  MicIcon, MicOffIcon, MonitorUpIcon, MonitorXIcon, PhoneOffIcon, SettingsIcon, SmilePlusIcon, UsersIcon, VideoIcon, VideoOffIcon, LinkIcon,
} from 'lucide-react'

const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '😮', '💚'];

const CtrlButton = ({ icon: Icon, label, onClick, active, off, badge, badgeTone = 'accent', tip, className = '', ...rest }) => (
  <button
    onClick={onClick}
    aria-label={label}
    aria-pressed={active ?? undefined}
    data-tip={tip || label}
    className={`relative grid size-12 shrink-0 place-items-center rounded-2xl border transition-all active:scale-95 ${
      off ? 'border-transparent bg-danger/90 text-white hover:bg-danger'
        : active ? 'border-transparent bg-accent text-[var(--accent-ink)]'
          : 'border-line bg-surface-2 text-fg hover:bg-surface-3'
    } ${className}`}
    {...rest}
  >
    <Icon size={20} />
    {badge ? (
      <span className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10.5px] font-bold ring-2 ring-[var(--bg)] ${badgeTone === 'accent' ? 'bg-accent text-[var(--accent-ink)]' : 'bg-surface-3 text-fg backdrop-blur'}`}>{badge}</span>
    ) : null}
  </button>
);

const usePopover = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return { open, setOpen, ref };
};

const ControlBar = ({
  audioEnabled, videoEnabled, onToggleAudio, onToggleVideo,
  sharing, canShare, onToggleShare,
  handRaised, onToggleHand, onReact,
  captionsOn, captionsSupported, onToggleCaptions,
  panel, onTogglePanel, unread, participantCount,
  layout, onToggleLayout, onSettings, onShortcuts, onCopyLink,
  isHost, onLeave, onEndForAll,
}) => {
  const reactions = usePopover();
  const more = usePopover();
  const leave = usePopover();

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
      <CtrlButton icon={audioEnabled ? MicIcon : MicOffIcon} label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'} tip={`${audioEnabled ? 'Mute' : 'Unmute'} (M)`} onClick={onToggleAudio} off={!audioEnabled} />
      <CtrlButton icon={videoEnabled ? VideoIcon : VideoOffIcon} label={videoEnabled ? 'Turn camera off' : 'Turn camera on'} tip={`Camera (V)`} onClick={onToggleVideo} off={!videoEnabled} />
      {canShare && (
        <CtrlButton icon={sharing ? MonitorXIcon : MonitorUpIcon} label={sharing ? 'Stop presenting' : 'Present your screen'} tip={sharing ? 'Stop presenting' : 'Present screen'} onClick={onToggleShare} active={sharing} className="hidden sm:grid" />
      )}

      <div className="relative" ref={reactions.ref}>
        <CtrlButton icon={SmilePlusIcon} label="Send a reaction" tip="React" onClick={() => reactions.setOpen((o) => !o)} aria-expanded={reactions.open} />
        {reactions.open && (
          <div className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-2xl border border-line-strong bg-panel-solid p-1.5 shadow-deep animate-pop-in" role="menu">
            {REACTIONS.map((r) => (
              <button key={r} className="grid size-11 place-items-center rounded-xl text-2xl transition-transform hover:scale-125 hover:bg-surface-2" onClick={() => onReact(r)} aria-label={`React ${r}`} role="menuitem">
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <CtrlButton icon={HandIcon} label={handRaised ? 'Lower hand' : 'Raise hand'} tip={`${handRaised ? 'Lower' : 'Raise'} hand (H)`} onClick={onToggleHand} active={handRaised} />
      <CtrlButton
        icon={captionsOn ? CaptionsIcon : CaptionsOffIcon}
        label={captionsOn ? 'Turn off captions' : 'Turn on captions'}
        tip={captionsSupported ? 'Live captions (L)' : 'Captions need Chrome, Edge or Safari'}
        onClick={onToggleCaptions}
        active={captionsOn}
        disabled={!captionsSupported}
        className="hidden disabled:opacity-40 sm:grid"
      />

      <span className="mx-1 hidden h-8 w-px bg-line-strong sm:block" />

      <CtrlButton icon={MessageSquareIcon} label="Chat" tip="Chat (C)" onClick={() => onTogglePanel('chat')} active={panel === 'chat'} badge={panel === 'chat' ? 0 : unread} />
      <CtrlButton icon={UsersIcon} label="People" tip="People (P)" onClick={() => onTogglePanel('people')} active={panel === 'people'} badge={participantCount} badgeTone="neutral" className="hidden sm:grid" />

      <div className="relative" ref={more.ref}>
        <CtrlButton icon={EllipsisIcon} label="More options" tip="More" onClick={() => more.setOpen((o) => !o)} aria-expanded={more.open} />
        {more.open && (
          <div className="absolute bottom-16 right-0 z-30 w-60 overflow-hidden rounded-2xl border border-line-strong bg-panel-solid p-1.5 text-sm shadow-deep animate-pop-in sm:left-1/2 sm:right-auto sm:-translate-x-1/2" role="menu">
            {[
              { icon: UsersIcon, label: 'People', onClick: () => onTogglePanel('people'), mobile: true },
              captionsSupported && { icon: CaptionsIcon, label: captionsOn ? 'Turn off captions' : 'Turn on captions', onClick: onToggleCaptions, mobile: true },
              { icon: LayoutGridIcon, label: layout === 'grid' ? 'Spotlight layout' : 'Grid layout', onClick: onToggleLayout },
              { icon: LinkIcon, label: 'Copy invite link', onClick: onCopyLink },
              { icon: SettingsIcon, label: 'Audio & video settings', onClick: onSettings },
              { icon: KeyboardIcon, label: 'Keyboard shortcuts', onClick: onShortcuts, desktop: true },
            ].filter(Boolean).map(({ icon: Icon, label, onClick, mobile, desktop }) => (
              <button
                key={label}
                role="menuitem"
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2 ${mobile ? 'sm:hidden' : ''} ${desktop ? 'hidden sm:flex' : ''}`}
                onClick={() => { onClick(); more.setOpen(false); }}
              >
                <Icon size={16} className="text-fg-2" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isHost ? (
        <div className="relative ml-1" ref={leave.ref}>
          <button className="btn btn-danger h-12 rounded-2xl px-4" onClick={() => leave.setOpen((o) => !o)} aria-expanded={leave.open} aria-label="Leave or end the meeting">
            <PhoneOffIcon size={19} /> <ChevronUpIcon size={15} className="hidden sm:block" />
          </button>
          {leave.open && (
            <div className="absolute bottom-16 right-0 z-30 w-60 overflow-hidden rounded-2xl border border-line-strong bg-panel-solid p-1.5 text-sm shadow-deep animate-pop-in" role="menu">
              <button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-surface-2" onClick={onLeave}>
                <p className="font-medium">Leave meeting</p>
                <p className="text-[12px] text-fg-3">Others can keep talking</p>
              </button>
              <button role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-danger hover:bg-surface-2" onClick={onEndForAll}>
                <p className="font-medium">End for everyone</p>
                <p className="text-[12px] text-fg-3">Closes the meeting for all</p>
              </button>
            </div>
          )}
        </div>
      ) : (
        <button className="btn btn-danger ml-1 h-12 rounded-2xl px-5" onClick={onLeave} aria-label="Leave meeting" data-tip="Leave">
          <PhoneOffIcon size={19} />
        </button>
      )}
    </div>
  );
};

export default ControlBar
