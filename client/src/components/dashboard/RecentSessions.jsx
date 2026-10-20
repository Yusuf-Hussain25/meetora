import { Link } from 'react-router-dom'
import { ArrowRightIcon, CaptionsIcon, HistoryIcon, MessageSquareIcon } from 'lucide-react'
import { AvatarStack } from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import { formatDuration, formatRelative, meetingDuration } from '../../lib/format'

const RecentSessions = ({ sessions }) => (
  <div className="card flex h-full flex-col p-5 sm:p-6">
    <div className="flex items-center justify-between">
      <p className="eyebrow">Recent sessions</p>
      <Link to="/sessions" className="flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
        View all <ArrowRightIcon size={14} />
      </Link>
    </div>

    {sessions.length === 0 ? (
      <EmptyState icon={<HistoryIcon size={26} />} title="No meetings yet" className="flex-1 py-10">
        Your past meetings, who joined and the chat will show up here.
      </EmptyState>
    ) : (
      <ul className="mt-3 divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.meetingId}>
            <Link to={`/sessions?open=${s.meetingId}`} className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-surface sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold">{s.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-fg-3">
                  <span>{formatRelative(s.startedAt || s.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDuration(meetingDuration(s))}</span>
                  {s.messageCount > 0 && <span className="flex items-center gap-1"><MessageSquareIcon size={12} /> {s.messageCount}</span>}
                  {s.transcriptCount > 0 && <span className="flex items-center gap-1"><CaptionsIcon size={12} /> {s.transcriptCount}</span>}
                </p>
              </div>
              <AvatarStack people={s.participants.map((p) => ({ id: p.user?.id, name: p.name, image: p.image }))} max={4} size={28} />
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default RecentSessions
