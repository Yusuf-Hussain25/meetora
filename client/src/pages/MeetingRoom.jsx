import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { CopyIcon, LayoutGridIcon, PresentationIcon, UsersIcon, VideoOffIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../config/api'
import Loader from '../components/Loader'
import { LogoMark } from '../components/ui/Logo'
import Lobby from '../components/meeting/Lobby'
import Stage from '../components/meeting/Stage'
import ControlBar from '../components/meeting/ControlBar'
import SidePanel from '../components/meeting/SidePanel'
import PostCall from '../components/meeting/PostCall'
import { CaptionsLayer, ReactionsLayer } from '../components/meeting/Overlays'
import { SettingsModal, ShortcutsModal } from '../components/meeting/RoomDialogs'
import { useLocalMedia } from '../hooks/useLocalMedia'
import { useMeeting } from '../hooks/useMeeting'
import { useLiveCaptions } from '../hooks/useLiveCaptions'
import { useSpeakers } from '../hooks/useAudioLevel'
import { useNow } from '../hooks/useNow'
import { apiError, copyText, inviteLink } from '../lib/meetings'
import { formatClock } from '../lib/format'

const REACTION_KEYS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '😮', '💚'];
const canShareScreen = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);

const MeetingRoom = () => {
  const { meetingId } = useParams();
  const { user } = useUser();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [joined, setJoined] = useState(0); // join attempt counter; 0 = still in the lobby
  const [panel, setPanel] = useState(null); // 'chat' | 'people' | null
  const [unread, setUnread] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [layout, setLayout] = useState('auto'); // auto | grid | spotlight
  const [pinned, setPinned] = useState(null);
  const [mirror, setMirror] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [joinedAt, setJoinedAt] = useState(null);
  const [peopleSeen, setPeopleSeen] = useState(() => new Set());
  const [lastSpeaker, setLastSpeaker] = useState(null);

  const meetingRef = useRef(null);
  const panelRef = useRef(panel);
  useEffect(() => { panelRef.current = panel; }, [panel]);

  const media = useLocalMedia({ onTrackChange: (kind, track) => meetingRef.current?.syncTrack(kind, track) });

  const onMessage = useCallback((msg) => {
    if (msg.senderId === user?.id || panelRef.current === 'chat') return;
    setUnread((n) => n + 1);
    toast(`${msg.senderName.split(' ')[0]}: ${msg.text.slice(0, 80)}`, { icon: '💬', id: `msg-${msg.id}` });
  }, [user?.id]);

  const meeting = useMeeting({ roomId: meetingId, joined, media, onMessage });
  useEffect(() => { meetingRef.current = meeting; });

  const { supported: captionsSupported, error: captionsError } = useLiveCaptions({
    enabled: captionsOn && meeting.status === 'live',
    micOn: media.audioEnabled,
    onResult: meeting.sendCaption,
  });
  useEffect(() => {
    if (captionsError) toast.error(captionsError);
  }, [captionsError]);

  // Meeting details for the lobby; ended or unknown meetings never reach the camera prompt
  useEffect(() => {
    let cancelled = false;
    api.get(`/api/meetings/${meetingId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setInfo(data.meeting);
        media.start();
      })
      .catch((err) => !cancelled && setLoadError(apiError(err, 'Meeting not found')));
    return () => { cancelled = true; };
  }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps -- media.start is stable

  // Release the camera as soon as the call is over
  useEffect(() => {
    if (meeting.status === 'ended') media.stopAll();
  }, [meeting.status]); // eslint-disable-line react-hooks/exhaustive-deps -- stopAll is stable

  // Remember everyone who was in the call for the recap
  useEffect(() => {
    setPeopleSeen((prev) => {
      const ids = meeting.remotes.map((r) => r.userId).filter((id) => id && !prev.has(id));
      return ids.length ? new Set([...prev, ...ids]) : prev;
    });
  }, [meeting.remotes]);

  const join = () => {
    setJoinedAt(Date.now());
    setJoined((n) => n + 1);
  };

  const rejoin = async () => {
    await media.start();
    join();
  };

  const togglePanel = useCallback((tab) => {
    setPanel((current) => (current === tab ? null : tab));
    if (tab === 'chat') setUnread(0);
  }, []);

  const copyInvite = useCallback(() => copyText(inviteLink(meetingId), 'Invite link copied'), [meetingId]);

  const toggleShare = () => (meeting.screenStream ? meeting.stopShare() : meeting.startShare());

  const toggleCaptions = useCallback(() => {
    if (!captionsSupported) return;
    setCaptionsOn((on) => {
      toast(on ? 'Captions off' : 'Captions on. Your speech is transcribed while your mic is on.', { icon: on ? '🔕' : '💬', id: 'captions' });
      return !on;
    });
  }, [captionsSupported]);

  // ---------------------------------------------------------------- keyboard shortcuts
  useEffect(() => {
    if (meeting.status !== 'live') return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (k === 'm') media.toggleAudio();
      else if (k === 'v') media.toggleVideo();
      else if (k === 'h') meeting.toggleHand();
      else if (k === 'l') toggleCaptions();
      else if (k === 'c') togglePanel('chat');
      else if (k === 'p') togglePanel('people');
      else if (k === 'g') setLayout((l) => (l === 'grid' ? 'spotlight' : 'grid'));
      else if (e.key === '?') setShortcutsOpen(true);
      else if (e.key === 'Escape') setPanel(null);
      else if (/^[1-8]$/.test(e.key)) meeting.sendReaction(REACTION_KEYS[Number(e.key) - 1]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [meeting.status, media, meeting, toggleCaptions, togglePanel]);

  // ---------------------------------------------------------------- tiles
  const selfName = user?.fullName || user?.firstName || 'You';
  const tiles = useMemo(() => [
    {
      id: 'self',
      isLocal: true,
      name: `${selfName} (You)`,
      image: user?.imageUrl,
      stream: meeting.screenStream || media.stream,
      audioEnabled: media.audioEnabled,
      videoEnabled: media.videoEnabled || Boolean(meeting.screenStream),
      screenSharing: Boolean(meeting.screenStream),
      handRaised: meeting.handRaised,
      isHost: meeting.isHost,
    },
    ...meeting.remotes.map((r) => ({
      id: r.socketId,
      userId: r.userId,
      name: r.userName || 'Guest',
      image: r.image,
      stream: r.stream,
      audioEnabled: r.audioEnabled,
      videoEnabled: r.videoEnabled,
      screenSharing: r.screenSharing,
      handRaised: r.handRaised,
      isHost: r.isHost,
      connection: r.connection,
    })),
  ], [selfName, user?.imageUrl, meeting.screenStream, media.stream, media.audioEnabled, media.videoEnabled, meeting.handRaised, meeting.isHost, meeting.remotes]);

  const speaking = useSpeakers(useMemo(() => [
    { id: 'self', stream: media.stream },
    ...meeting.remotes.map((r) => ({ id: r.socketId, stream: r.stream })),
  ], [media.stream, meeting.remotes]));

  useEffect(() => {
    const remoteSpeaker = [...speaking].find((id) => id !== 'self');
    if (remoteSpeaker) setLastSpeaker(remoteSpeaker);
  }, [speaking]);

  const presenter = meeting.remotes.find((r) => r.screenSharing)?.socketId;
  const pinnedValid = pinned && tiles.some((t) => t.id === pinned) ? pinned : null;
  const spotlightId = layout === 'grid' && !pinnedValid
    ? null
    : pinnedValid || presenter || (layout === 'spotlight' ? (lastSpeaker && tiles.some((t) => t.id === lastSpeaker) ? lastSpeaker : tiles[1]?.id) : null);

  const hostActionsFor = (t) => (meeting.isHost && !t.isLocal
    ? { onMute: () => meeting.hostMute(t.id), onRemove: () => meeting.hostRemove(t.id) }
    : null);

  const now = useNow(1000);
  const startedAt = meeting.meeting?.startedAt ? new Date(meeting.meeting.startedAt).getTime() : joinedAt;

  // ---------------------------------------------------------------- screens
  if (loadError) {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <div className="card w-full max-w-md p-8 text-center animate-pop-in">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-fg-2"><VideoOffIcon size={24} /></span>
          <h1 className="mt-5 text-xl font-semibold">{loadError}</h1>
          <p className="mt-1.5 text-sm text-fg-3">Check the link with whoever invited you, or start a new meeting.</p>
          <Link to="/dashboard" className="btn btn-primary mt-6">Back to home</Link>
        </div>
      </main>
    );
  }

  if (!info) return <Loader text="Getting the room ready" />;

  if (meeting.status === 'ended') {
    return (
      <PostCall
        info={meeting.endInfo}
        title={meeting.meeting?.title || info.title}
        meetingId={meetingId}
        spentMs={joinedAt ? Date.now() - joinedAt : 0}
        peopleSeen={peopleSeen.size + 1}
        messageCount={meeting.messages.length}
        onRejoin={rejoin}
      />
    );
  }

  if (!joined) {
    return (
      <>
        <Lobby info={info} media={media} user={user} onJoin={join} onSettings={() => setSettingsOpen(true)} />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} media={media} mirror={mirror} onMirror={setMirror} />
      </>
    );
  }

  if (meeting.status !== 'live') return <Loader text="Joining the meeting" />;

  const people = tiles.map((t) => ({ ...t, name: t.isLocal ? `${selfName} (You)` : t.name }));

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-3 pt-3 sm:px-5">
        <LogoMark size={28} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold">{meeting.meeting?.title || info.title}</h1>
          <p className="flex items-center gap-2 text-[12px] text-fg-3">
            <span className="flex items-center gap-1.5 font-mono tabular-nums"><span className="size-1.5 rounded-full bg-danger animate-pulse" />{formatClock(now - startedAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1"><UsersIcon size={12} /> {tiles.length}</span>
            {meeting.screenStream && <span className="chip chip-accent h-5 text-[11px]">You're presenting</span>}
          </p>
        </div>
        <div className="segmented hidden md:inline-flex" role="group" aria-label="Layout">
          <button aria-pressed={!spotlightId} onClick={() => { setLayout('grid'); setPinned(null); }}><LayoutGridIcon size={14} /> Grid</button>
          <button aria-pressed={Boolean(spotlightId)} onClick={() => setLayout('spotlight')}><PresentationIcon size={14} /> Spotlight</button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyInvite}>
          <CopyIcon size={14} /> <span className="hidden font-mono sm:inline">{meetingId}</span>
        </button>
      </header>

      {/* Stage + side panel */}
      <div className="flex min-h-0 flex-1 gap-3 p-3 sm:px-5">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <Stage
            tiles={tiles}
            spotlightId={spotlightId}
            speaking={speaking}
            pinnedId={pinnedValid}
            onPin={setPinned}
            sinkId={media.selected.audiooutput}
            mirror={mirror}
            hostActionsFor={hostActionsFor}
          />
          <ReactionsLayer reactions={meeting.reactions} />
          <CaptionsLayer captions={meeting.captions} on={captionsOn} />
          {tiles.length === 1 && !spotlightId && (
            <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
              <div className="pointer-events-auto glass flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm shadow-soft animate-fade-up">
                <span className="text-fg-2">You're the only one here.</span>
                <button className="font-semibold text-accent-text hover:underline" onClick={copyInvite}>Copy invite link</button>
              </div>
            </div>
          )}
        </div>

        {panel && (
          <SidePanel
            tab={panel}
            onTab={(t) => { setPanel(t); if (t === 'chat') setUnread(0); }}
            onClose={() => setPanel(null)}
            chat={{ messages: meeting.messages, selfId: user?.id, onSend: meeting.sendMessage }}
            people={{
              people,
              isHost: meeting.isHost,
              onMute: meeting.hostMute,
              onMuteAll: () => { meeting.hostMuteAll(); toast('Asked everyone to mute'); },
              onRemove: (p) => meeting.hostRemove(p.id),
              onCopyLink: copyInvite,
            }}
          />
        )}
      </div>

      {/* Controls */}
      <footer className="px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-5 sm:pb-5">
        <ControlBar
          audioEnabled={media.audioEnabled}
          videoEnabled={media.videoEnabled}
          onToggleAudio={media.toggleAudio}
          onToggleVideo={media.toggleVideo}
          sharing={Boolean(meeting.screenStream)}
          canShare={canShareScreen}
          onToggleShare={toggleShare}
          handRaised={meeting.handRaised}
          onToggleHand={meeting.toggleHand}
          onReact={meeting.sendReaction}
          captionsOn={captionsOn}
          captionsSupported={captionsSupported}
          onToggleCaptions={toggleCaptions}
          panel={panel}
          onTogglePanel={togglePanel}
          unread={unread}
          participantCount={tiles.length}
          layout={spotlightId ? 'spotlight' : 'grid'}
          onToggleLayout={() => { setPinned(null); setLayout(spotlightId ? 'grid' : 'spotlight'); }}
          onSettings={() => setSettingsOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
          onCopyLink={copyInvite}
          isHost={meeting.isHost}
          onLeave={meeting.leave}
          onEndForAll={meeting.endForAll}
        />
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} media={media} mirror={mirror} onMirror={setMirror} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};

export default MeetingRoom
