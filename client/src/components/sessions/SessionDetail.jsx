import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaptionsIcon, ClockIcon, CopyIcon, DownloadIcon, FileTextIcon, MessageSquareIcon, SearchIcon, Trash2Icon, UsersIcon, VideoIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../config/api'
import Modal from '../ui/Modal'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import { apiError, copyText, inviteLink } from '../../lib/meetings'
import { formatDateTime, formatDuration, formatTime, meetingDuration, toDate } from '../../lib/format'

// Gantt-style attendance: one bar per person across the meeting's length
const Attendance = ({ session }) => {
  const start = toDate(session.startedAt || session.createdAt).getTime();
  const end = (toDate(session.endedAt) || new Date()).getTime();
  const span = Math.max(1, end - start);
  return (
    <ul className="space-y-3">
      {session.participants.map((p, i) => {
        const joined = Math.max(start, toDate(p.joinedAt).getTime());
        const left = Math.min(end, (toDate(p.leftAt) || toDate(session.endedAt) || new Date()).getTime());
        const offset = ((joined - start) / span) * 100;
        const width = Math.max(1.5, ((left - joined) / span) * 100);
        return (
          <li key={`${p.user?.id || p.name}-${i}`} className="grid grid-cols-[minmax(0,150px)_1fr_56px] items-center gap-3 sm:grid-cols-[minmax(0,190px)_1fr_64px]">
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar src={p.image} name={p.name} size={30} />
              <span className="truncate text-sm">{p.name}{session.host.id === p.user?.id && <span className="ml-1.5 text-[11px] text-fg-3">host</span>}</span>
            </span>
            <span className="relative h-2.5 rounded-full bg-surface-2" title={`${formatTime(joined)} – ${formatTime(left)}`}>
              <span className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${offset}%`, width: `${Math.min(width, 100 - offset)}%` }} />
            </span>
            <span className="text-right text-[12.5px] tabular-nums text-fg-3">{formatDuration(left - joined)}</span>
          </li>
        );
      })}
      <li className="grid grid-cols-[minmax(0,150px)_1fr_56px] gap-3 text-[11.5px] text-fg-3 sm:grid-cols-[minmax(0,190px)_1fr_64px]">
        <span />
        <span className="flex justify-between"><span>{formatTime(start)}</span><span>{formatTime(end)}</span></span>
        <span />
      </li>
    </ul>
  );
};

const Transcript = ({ session }) => {
  const [query, setQuery] = useState('');
  const lines = session.transcript.filter((t) => !query || t.text.toLowerCase().includes(query.toLowerCase()) || t.speakerName.toLowerCase().includes(query.toLowerCase()));

  const download = () => {
    const text = [
      `${session.title}`,
      `${formatDateTime(session.startedAt || session.createdAt)} · ${formatDuration(meetingDuration(session))}`,
      '',
      ...session.transcript.map((t) => `[${formatTime(t.timestamp)}] ${t.speakerName}: ${t.text}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${session.title.replace(/[^\w-]+/g, '-').toLowerCase()}-transcript.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session.transcript.length) {
    return (
      <EmptyState icon={<CaptionsIcon size={24} />} title="No transcript for this meeting">
        Turn on live captions during a call and every sentence is saved here.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 flex gap-2">
        <label className="input-wrap flex-1">
          <SearchIcon size={16} />
          <span className="sr-only">Search transcript</span>
          <input className="input h-10" placeholder="Search the transcript" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="btn btn-ghost h-10" onClick={download}><DownloadIcon size={15} /> .txt</button>
      </div>
      {lines.length === 0 ? <p className="py-8 text-center text-sm text-fg-3">No lines match “{query}”.</p> : (
        <ol className="space-y-4">
          {lines.map((t) => (
            <li key={t.id} className="flex gap-3">
              <span className="w-16 shrink-0 pt-0.5 text-right font-mono text-[11.5px] text-fg-3">{formatTime(t.timestamp)}</span>
              <div>
                <p className="text-[13px] font-semibold text-accent-text">{t.speakerName}</p>
                <p className="mt-0.5 text-[14.5px] leading-relaxed text-fg">{t.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
};

const ChatLog = ({ session }) => (
  session.messages.length === 0 ? (
    <EmptyState icon={<MessageSquareIcon size={24} />} title="No chat messages">Nobody wrote in the chat during this meeting.</EmptyState>
  ) : (
    <ul className="space-y-4">
      {session.messages.map((m) => (
        <li key={m.id} className="flex gap-3">
          <Avatar src={m.senderImage} name={m.senderName} size={32} />
          <div className="min-w-0">
            <p className="text-[12.5px] text-fg-3"><span className="font-semibold text-fg-2">{m.senderName}</span> · {formatTime(m.timestamp)}</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px]">{m.text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
);

// Full recap of one meeting, loaded on open.
const SessionDetail = ({ meetingId, onClose, onDeleted, currentUserId }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    setSession(null);
    setTab('overview');
    setConfirmDelete(false);
    api.get(`/api/meetings/sessions/${meetingId}`)
      .then(({ data }) => !cancelled && setSession(data.meeting))
      .catch((err) => {
        if (cancelled) return;
        toast.error(apiError(err, "Couldn't load this session"));
        onClose();
      });
    return () => { cancelled = true; };
  }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps -- onClose is a fresh closure each render

  const summary = useMemo(() => {
    if (!session) return '';
    return [
      `${session.title}: ${formatDateTime(session.startedAt || session.createdAt)}, ${formatDuration(meetingDuration(session))}`,
      `Attendees: ${session.participants.map((p) => p.name).join(', ')}`,
      session.transcript.length ? `\nKey moments:\n${session.transcript.slice(-5).map((t) => `- ${t.speakerName}: ${t.text}`).join('\n')}` : '',
    ].join('\n');
  }, [session]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/meetings/${meetingId}`);
      toast.success('Session deleted');
      onDeleted(meetingId);
    } catch (err) {
      toast.error(apiError(err, "Couldn't delete the session"));
    } finally {
      setBusy(false);
    }
  };

  const isHost = session?.host.id === currentUserId;
  const live = session?.status === 'active';

  return (
    <Modal
      open={Boolean(meetingId)}
      onClose={onClose}
      size="lg"
      title={session?.title || 'Loading session…'}
      subtitle={session ? `${formatDateTime(session.startedAt || session.createdAt)} · hosted by ${isHost ? 'you' : session.host.name}` : ' '}
      icon={<FileTextIcon size={20} />}
      footer={session && (
        <>
          {isHost && !live && (confirmDelete ? (
            <button className="btn btn-danger btn-sm mr-auto" onClick={remove} disabled={busy}>{busy && <span className="spinner size-4" />} Confirm delete</button>
          ) : (
            <button className="btn btn-ghost btn-sm mr-auto hover:!text-danger" onClick={() => setConfirmDelete(true)}><Trash2Icon size={15} /> Delete</button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => copyText(summary, 'Summary copied')}><CopyIcon size={15} /> Copy summary</button>
          {live && <button className="btn btn-primary btn-sm" onClick={() => navigate(`/meeting/${session.meetingId}`)}><VideoIcon size={15} /> Rejoin</button>}
        </>
      )}
    >
      {!session ? (
        <div className="space-y-4 p-6"><div className="skeleton h-20 w-full" /><div className="skeleton h-4 w-2/3" /><div className="skeleton h-4 w-1/2" /></div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              [ClockIcon, formatDuration(meetingDuration(session)), live ? 'so far' : 'duration'],
              [UsersIcon, session.participants.length, 'attended'],
              [CaptionsIcon, session.transcript.length, 'caption lines'],
            ].map(([Icon, value, label]) => (
              <div key={label} className="rounded-2xl border border-line bg-surface p-3.5">
                <Icon size={16} className="text-fg-3" />
                <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
                <p className="text-[12px] text-fg-3">{label}</p>
              </div>
            ))}
          </div>

          {session.description && <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-fg-2">{session.description}</p>}

          <div className="segmented mt-5 w-full sm:w-auto" role="tablist">
            {[['overview', 'Attendance'], ['transcript', `Transcript · ${session.transcript.length}`], ['chat', `Chat · ${session.messages.length}`]].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} aria-pressed={tab === id} className="flex-1 justify-center sm:flex-none" onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          <div className="mt-5">
            {tab === 'overview' && <Attendance session={session} />}
            {tab === 'transcript' && <Transcript session={session} />}
            {tab === 'chat' && <ChatLog session={session} />}
          </div>

          {live && (
            <p className="mt-5 flex items-center gap-2 text-[13px] text-fg-3">
              <span className="size-2 rounded-full bg-danger animate-pulse" /> This meeting is still open. <button className="font-medium text-accent-text hover:underline" onClick={() => copyText(inviteLink(session.meetingId), 'Invite link copied')}>Copy invite link</button>
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default SessionDetail
