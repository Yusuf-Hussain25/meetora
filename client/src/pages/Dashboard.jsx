import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { CalendarPlusIcon, ClockIcon, CopyIcon, MessageSquareIcon, RadioIcon, UsersIcon, VideoIcon, CalendarCheckIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../config/api'
import { useNow } from '../hooks/useNow'
import { useStartMeeting } from '../hooks/useStartMeeting'
import { apiError, copyText, inviteLink } from '../lib/meetings'
import { formatRelative, formatTime, greeting } from '../lib/format'
import Avatar, { AvatarStack } from '../components/ui/Avatar'
import JoinForm from '../components/dashboard/JoinForm'
import ScheduleModal from '../components/dashboard/ScheduleModal'
import ActivityChart from '../components/dashboard/ActivityChart'
import StatTile, { StatTileSkeleton } from '../components/dashboard/StatTile'
import PlanCard from '../components/dashboard/PlanCard'
import UpcomingList from '../components/dashboard/UpcomingList'
import RecentSessions from '../components/dashboard/RecentSessions'

const hours = (minutes) => (minutes >= 60 ? `${(minutes / 60).toFixed(minutes >= 600 ? 0 : 1)}h` : `${minutes}m`);

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const now = useNow(1000);
  const { start, starting } = useStartMeeting();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const [stats, upcoming, sessions] = await Promise.all([
        api.get('/api/meetings/stats', { params: { tz } }),
        api.get('/api/meetings/upcoming'),
        api.get('/api/meetings/sessions'),
      ]);
      setData({ stats: stats.data, upcoming: upcoming.data.upcoming, live: upcoming.data.live, sessions: sessions.data.meetings });
      setFailed(false);
    } catch (err) {
      setFailed(true);
      toast.error(apiError(err, "Couldn't load your dashboard"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'there';
  const next = data?.upcoming?.[0];
  const loading = !data;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Live now */}
      {data?.live?.map((m) => (
        <div key={m.meetingId} className="card flex flex-wrap items-center gap-3 rounded-[22px] border-accent/30 p-4 animate-fade-up sm:px-5">
          <span className="relative grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <RadioIcon size={18} />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-danger ring-2 ring-[var(--panel-solid)] animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{m.title} is live</p>
            <p className="text-[13px] text-fg-3">{m.live.length} {m.live.length === 1 ? 'person is' : 'people are'} in the meeting</p>
          </div>
          <AvatarStack people={m.live} size={28} />
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/meeting/${m.meetingId}`)}>Join now</button>
        </div>
      ))}

      <section className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        {/* Hero */}
        <div className="card relative overflow-hidden p-6 sm:p-8 lg:col-span-8 animate-fade-up">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_210px]">
          <div className="min-w-0">
          <p className="eyebrow">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.035em] sm:text-[40px]">
            {greeting(now)}, <span className="gradient-text">{firstName}</span>
          </h1>
          <p className="mt-1 font-mono text-[15px] text-fg-3 tabular-nums">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>

          <div className="mt-7 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
            <button className="btn btn-primary btn-lg" onClick={() => start()} disabled={starting}>
              {starting ? <span className="spinner" /> : <VideoIcon size={19} />}
              {starting ? 'Starting…' : 'New meeting'}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => setScheduleOpen(true)}>
              <CalendarPlusIcon size={19} /> Schedule
            </button>
          </div>

          <div className="mt-6 max-w-xl">
            <p className="mb-2 text-[13px] font-medium text-fg-2">Have a code? Join a meeting</p>
            <JoinForm />
          </div>
          </div>

          {/* Your circle: the people you meet most */}
          <aside className="hidden md:block">
            <p className="eyebrow">Your circle</p>
            <ul className="mt-3 space-y-2.5">
              {loading
                ? Array.from({ length: 5 }, (_, i) => <li key={i} className="flex items-center gap-2.5"><div className="skeleton size-9 rounded-full" /><div className="skeleton h-3.5 w-24" /></li>)
                : data.stats.circle.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <Avatar src={p.image} name={p.name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{p.name}</p>
                      <p className="text-[12px] text-fg-3">{p.meetings} meeting{p.meetings === 1 ? '' : 's'} together</p>
                    </div>
                  </li>
                ))}
              {!loading && data.stats.circle.length === 0 && (
                <li className="text-[13px] text-fg-3">People you meet will show up here.</li>
              )}
            </ul>
          </aside>
          </div>
        </div>

        {/* Up next */}
        <div className="card flex flex-col p-6 lg:col-span-4 animate-fade-up [animation-delay:.05s]">
          <p className="eyebrow">Up next</p>
          {loading ? (
            <div className="mt-4 space-y-3"><div className="skeleton h-6 w-3/4" /><div className="skeleton h-4 w-1/2" /><div className="skeleton mt-6 h-10 w-full" /></div>
          ) : next ? (
            <>
              <p className="mt-3 text-xl font-semibold tracking-tight">{next.title}</p>
              <p className="mt-1 text-sm text-fg-2">
                {new Date(next.scheduledFor).toLocaleDateString([], { weekday: 'long' })}, {formatTime(next.scheduledFor)}
              </p>
              {next.description && <p className="mt-3 line-clamp-2 text-[13.5px] text-fg-3">{next.description}</p>}
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-surface p-3.5">
                <ClockIcon size={18} className="text-accent-text" />
                <p className="text-sm">Starts <span className="font-semibold">{formatRelative(next.scheduledFor)}</span></p>
              </div>
              <div className="mt-auto flex gap-2 pt-5">
                <button className="btn btn-primary btn-sm flex-1" onClick={() => navigate(`/meeting/${next.meetingId}`)}><VideoIcon size={15} /> Start</button>
                <button className="btn btn-ghost btn-sm" onClick={() => copyText(inviteLink(next.meetingId), 'Invite link copied')}><CopyIcon size={15} /> Invite</button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center py-6">
              <CalendarCheckIcon size={28} className="text-accent-text" />
              <p className="mt-3 font-semibold">Your calendar is clear</p>
              <p className="mt-1 text-sm text-fg-3">Schedule a meeting and it shows up here with a countdown.</p>
              <button className="btn btn-ghost btn-sm mt-4" onClick={() => setScheduleOpen(true)}><CalendarPlusIcon size={15} /> Schedule</button>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4" aria-label="Your stats">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />)
        ) : (
          <>
            <StatTile icon={VideoIcon} label="Meetings" value={data.stats.totals.meetings} hint={`${data.stats.totals.hosted} hosted by you`} />
            <StatTile icon={ClockIcon} label="Time in calls" value={hours(data.stats.totals.minutes)} hint={`${data.stats.activity.reduce((s, d) => s + d.minutes, 0)} min this week`} />
            <StatTile icon={UsersIcon} label="People met" value={data.stats.totals.people} hint="across all meetings" />
            <StatTile icon={MessageSquareIcon} label="Messages sent" value={data.stats.totals.messages} hint="in meeting chats" />
          </>
        )}
      </section>

      {failed && !data && (
        <div className="card flex items-center justify-between gap-3 p-5">
          <p className="text-sm text-fg-2">We couldn't reach the server.</p>
          <button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>
        </div>
      )}

      <section className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {loading ? <div className="card h-72 p-6"><div className="skeleton h-4 w-48" /><div className="skeleton mt-3 h-8 w-24" /><div className="skeleton mt-8 h-36 w-full" /></div> : <ActivityChart activity={data.stats.activity} />}
        </div>
        <div className="lg:col-span-4">
          {loading ? <div className="card h-72 p-6"><div className="skeleton h-4 w-24" /><div className="skeleton mt-6 size-24 rounded-full" /></div> : <PlanCard stats={data.stats} />}
        </div>
      </section>

      <section className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-6">
          {loading ? <div className="card h-80 p-6"><div className="skeleton h-4 w-24" />{[0, 1, 2].map((i) => <div key={i} className="skeleton mt-5 h-12 w-full" />)}</div> : <UpcomingList meetings={data.upcoming} onSchedule={() => setScheduleOpen(true)} onChanged={load} />}
        </div>
        <div className="lg:col-span-6">
          {loading ? <div className="card h-80 p-6"><div className="skeleton h-4 w-32" />{[0, 1, 2].map((i) => <div key={i} className="skeleton mt-5 h-12 w-full" />)}</div> : <RecentSessions sessions={data.sessions.slice(0, 5)} />}
        </div>
      </section>

      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} onCreated={load} />
    </div>
  );
};

export default Dashboard
