import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, CalendarClockIcon, CopyIcon, MicIcon, MicOffIcon, SettingsIcon, ShieldAlertIcon, VideoIcon, VideoOffIcon } from 'lucide-react'
import Avatar, { AvatarStack } from '../ui/Avatar'
import { LogoMark } from '../ui/Logo'
import { useAudioLevel } from '../../hooks/useAudioLevel'
import { copyText, inviteLink } from '../../lib/meetings'
import { formatRelative, formatTime } from '../../lib/format'

const PERMISSION_HELP = {
  denied: 'Camera and microphone are blocked. Click the camera icon in the address bar, allow access, then reload.',
  notfound: "We couldn't find a camera or microphone. You can still join to listen and chat.",
  inuse: 'Your camera or microphone is being used by another app. Close it and try again.',
};

const MicMeter = ({ stream, enabled }) => {
  const level = useAudioLevel(enabled ? stream : null);
  return (
    <div className="flex h-4 items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="w-[4px] rounded-full transition-colors duration-75" style={{ height: 6 + (i % 3) * 3, background: level * 10 > i ? 'var(--accent)' : 'var(--surface-3)' }} />
      ))}
    </div>
  );
};

// Pre-join "green room": check how you look and sound, pick devices, see who's already inside.
const Lobby = ({ info, media, user, onJoin, onSettings }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream;
  }, [media.stream]);

  const name = user?.fullName || user?.firstName || 'You';
  const live = info.live || [];
  const scheduled = info.status === 'scheduled' && info.scheduledFor;
  const requesting = media.status !== 'ready';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/dashboard" className="btn btn-ghost btn-sm"><ArrowLeftIcon size={15} /> Back</Link>
        <span className="flex items-center gap-2 text-sm text-fg-3"><LogoMark size={22} /> Meetora</span>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 pb-10 sm:px-6 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
        {/* Preview */}
        <section className="animate-fade-up">
          <div className="relative aspect-video overflow-hidden rounded-[28px] border border-line bg-tile shadow-deep">
            <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 size-full -scale-x-100 object-cover transition-opacity ${media.videoEnabled ? 'opacity-100' : 'opacity-0'}`} />
            {!media.videoEnabled && (
              <div className="absolute inset-0 grid place-items-center">
                {requesting ? <span className="spinner size-8 text-fg-3" /> : (
                  <div className="flex flex-col items-center gap-3">
                    <Avatar src={user?.imageUrl} name={name} size={96} />
                    <p className="text-sm text-fg-3">Camera is off</p>
                  </div>
                )}
              </div>
            )}
            <span className="absolute left-4 top-4 rounded-lg bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">{name}</span>

            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
              <button
                className={`grid size-13 place-items-center rounded-full border transition-all active:scale-95 ${media.audioEnabled ? 'border-white/20 bg-black/45 text-white backdrop-blur hover:bg-black/60' : 'border-transparent bg-danger text-white'}`}
                onClick={media.toggleAudio}
                aria-label={media.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                aria-pressed={!media.audioEnabled}
              >
                {media.audioEnabled ? <MicIcon size={21} /> : <MicOffIcon size={21} />}
              </button>
              <button
                className={`grid size-13 place-items-center rounded-full border transition-all active:scale-95 ${media.videoEnabled ? 'border-white/20 bg-black/45 text-white backdrop-blur hover:bg-black/60' : 'border-transparent bg-danger text-white'}`}
                onClick={media.toggleVideo}
                aria-label={media.videoEnabled ? 'Turn camera off' : 'Turn camera on'}
                aria-pressed={!media.videoEnabled}
              >
                {media.videoEnabled ? <VideoIcon size={21} /> : <VideoOffIcon size={21} />}
              </button>
              <button className="grid size-13 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur hover:bg-black/60" onClick={onSettings} aria-label="Audio and video settings">
                <SettingsIcon size={20} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3 text-sm text-fg-2">
              <MicIcon size={16} className="text-fg-3" />
              <MicMeter stream={media.stream} enabled={media.audioEnabled} />
              <span className="text-fg-3">{media.audioEnabled ? 'Say something to test your mic' : 'Mic is muted'}</span>
            </div>
            {media.noiseSuppression && <span className="chip">Noise suppression on</span>}
          </div>

          {media.error && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm" role="alert">
              <ShieldAlertIcon size={18} className="mt-0.5 shrink-0 text-warn" />
              <p className="text-fg-2">{PERMISSION_HELP[media.error]}</p>
            </div>
          )}
        </section>

        {/* Join card */}
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left animate-fade-up [animation-delay:.06s]">
          <p className="eyebrow">Ready to join?</p>
          <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.03em] sm:text-[36px]">{info.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-fg-2">
            <Avatar src={info.host.image} name={info.host.name} size={22} /> Hosted by {info.host.name}
          </p>

          {scheduled && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
              <CalendarClockIcon size={16} className="text-accent-text" />
              Scheduled for {formatTime(info.scheduledFor)} ({formatRelative(info.scheduledFor)}). You can join early.
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            {live.length > 0 ? (
              <>
                <AvatarStack people={live} size={30} />
                <p className="text-sm text-fg-2">
                  {live.slice(0, 2).map((p) => p.name.split(' ')[0]).join(' and ')}
                  {live.length > 2 ? ` and ${live.length - 2} more are` : live.length === 1 ? ' is' : ' are'} in the meeting
                </p>
              </>
            ) : (
              <p className="text-sm text-fg-3">No one else is here yet.</p>
            )}
          </div>

          <button className="btn btn-primary btn-lg mt-8 w-full max-w-xs" onClick={onJoin} disabled={requesting}>
            {requesting ? <><span className="spinner" /> Getting camera ready…</> : 'Join now'}
          </button>
          <button className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-fg-3 hover:text-fg" onClick={() => copyText(inviteLink(info.meetingId), 'Invite link copied')}>
            <CopyIcon size={13} /> Copy invite link · <span className="font-mono">{info.meetingId}</span>
          </button>
        </section>
      </main>
    </div>
  );
};

export default Lobby
