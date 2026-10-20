import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { CaptionsIcon, ChevronRightIcon, CrownIcon, HistoryIcon, MessageSquareIcon, SearchIcon, VideoIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../config/api'
import { AvatarStack } from '../components/ui/Avatar'
import EmptyState from '../components/ui/EmptyState'
import SessionDetail from '../components/sessions/SessionDetail'
import { useStartMeeting } from '../hooks/useStartMeeting'
import { apiError } from '../lib/meetings'
import { formatDayLabel, formatDuration, formatTime, meetingDuration } from '../lib/format'

const FILTERS = [['all', 'All'], ['hosted', 'Hosted'], ['joined', 'Joined']];

const Sessions = () => {
  const { user } = useUser();
  const { start, starting } = useStartMeeting();
  const [params, setParams] = useSearchParams();
  const [sessions, setSessions] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const openId = params.get('open');

  useEffect(() => {
    api.get('/api/meetings/sessions')
      .then(({ data }) => setSessions(data.meetings))
      .catch((err) => {
        setSessions([]);
        toast.error(apiError(err, "Couldn't load your sessions"));
      });
  }, []);

  const visible = useMemo(() => {
    if (!sessions) return [];
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      const hosted = s.host.id === user?.id;
      if (filter === 'hosted' && !hosted) return false;
      if (filter === 'joined' && hosted) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q) || s.participants.some((p) => p.name.toLowerCase().includes(q));
    });
  }, [sessions, query, filter, user?.id]);

  // Group by calendar day, newest first (the API already sorts)
  const groups = useMemo(() => {
    const out = [];
    visible.forEach((s) => {
      const label = formatDayLabel(s.startedAt || s.createdAt);
      const last = out.at(-1);
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    });
    return out;
  }, [visible]);

  const totalMs = visible.reduce((sum, s) => sum + meetingDuration(s), 0);
  const open = (id) => setParams(id ? { open: id } : {}, { replace: true });

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[36px]">Sessions</h1>
          <p className="mt-1 text-fg-2">Every meeting you hosted or joined, with attendance, chat and transcripts.</p>
        </div>
        {sessions?.length > 0 && (
          <p className="text-sm text-fg-3">{visible.length} meeting{visible.length === 1 ? '' : 's'} · {formatDuration(totalMs)} total</p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="input-wrap flex-1">
          <SearchIcon size={17} />
          <span className="sr-only">Search sessions</span>
          <input className="input" placeholder="Search by title or person" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented self-start" role="group" aria-label="Filter sessions">
          {FILTERS.map(([id, label]) => (
            <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-7">
        {sessions === null ? (
          Array.from({ length: 2 }, (_, g) => (
            <div key={g}>
              <div className="skeleton mb-3 h-4 w-24" />
              <div className="card divide-y divide-line">
                {Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center gap-4 p-5"><div className="skeleton size-11 rounded-xl" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-3 w-1/4" /></div></div>)}
              </div>
            </div>
          ))
        ) : sessions.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<HistoryIcon size={26} />}
              title="No sessions yet"
              action={<button className="btn btn-primary" onClick={() => start()} disabled={starting}><VideoIcon size={17} /> Start a meeting</button>}
            >
              Once you host or join a meeting, its attendance, chat and transcript live here.
            </EmptyState>
          </div>
        ) : groups.length === 0 ? (
          <div className="card"><EmptyState icon={<SearchIcon size={24} />} title="No matches">Try another name or clear the filter.</EmptyState></div>
        ) : groups.map((group) => (
          <section key={group.label}>
            <h2 className="eyebrow mb-3 px-1">{group.label}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {group.items.map((s) => {
                const hosted = s.host.id === user?.id;
                const live = s.status === 'active';
                const startAt = s.startedAt || s.createdAt;
                return (
                  <li key={s.meetingId}>
                    <button className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface sm:px-5" onClick={() => open(s.meetingId)}>
                      <span className={`hidden size-11 shrink-0 place-items-center rounded-xl sm:grid ${live ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-fg-2'}`}>
                        <VideoIcon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold">{s.title}</span>
                          {live && <span className="chip chip-live h-5 text-[10.5px]">Live</span>}
                          {hosted && <CrownIcon size={13} className="shrink-0 text-amber-400" aria-label="You hosted" />}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-fg-3">
                          <span>{formatTime(startAt)}{s.endedAt && ` – ${formatTime(s.endedAt)}`}</span>
                          <span className="tabular-nums">{formatDuration(meetingDuration(s))}</span>
                          {!hosted && <span>by {s.host.name}</span>}
                          {s.messageCount > 0 && <span className="flex items-center gap-1"><MessageSquareIcon size={12} />{s.messageCount}</span>}
                          {s.transcriptCount > 0 && <span className="flex items-center gap-1"><CaptionsIcon size={12} />{s.transcriptCount}</span>}
                        </span>
                      </span>
                      <span className="hidden sm:block"><AvatarStack people={s.participants.map((p) => ({ id: p.user?.id, name: p.name, image: p.image }))} max={5} size={28} /></span>
                      <ChevronRightIcon size={18} className="shrink-0 text-fg-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <SessionDetail
        meetingId={openId}
        currentUserId={user?.id}
        onClose={() => open(null)}
        onDeleted={(id) => {
          setSessions((prev) => prev.filter((s) => s.meetingId !== id));
          open(null);
        }}
      />
    </div>
  );
};

export default Sessions
