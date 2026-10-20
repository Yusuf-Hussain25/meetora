import { Link } from 'react-router-dom'
import { ClockIcon, FileTextIcon, HouseIcon, MessageSquareIcon, PhoneOffIcon, RotateCcwIcon, UserMinusIcon, UsersIcon } from 'lucide-react'
import { formatDuration } from '../../lib/format'

const headline = (info) => {
  if (info?.endedByYou) return ['You ended the meeting', 'Everyone has been disconnected.'];
  if (info?.removed) return ['You were removed', 'The host removed you from this meeting.'];
  if (info?.endedByHost) return ['The meeting has ended', 'The host ended the meeting for everyone.'];
  if (info?.left) return ['You left the meeting', 'The others can keep talking. You can rejoin while it lasts.'];
  return ['Meeting unavailable', info?.message || 'This meeting has ended.'];
};

// Shown after leaving: a quick recap and the next step.
const PostCall = ({ info, title, meetingId, spentMs, peopleSeen, messageCount, onRejoin }) => {
  const [heading, sub] = headline(info);
  const canRejoin = info?.left;
  const wasInCall = spentMs > 0;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="card w-full max-w-lg p-7 text-center shadow-deep animate-pop-in sm:p-9">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-surface-2 text-fg-2">
          {info?.removed ? <UserMinusIcon size={28} /> : <PhoneOffIcon size={28} />}
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-1.5 text-fg-3">{sub}</p>
        {title && <p className="mt-4 text-sm font-medium text-fg-2">{title}</p>}

        {wasInCall && (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              [ClockIcon, formatDuration(spentMs), 'in the call'],
              [UsersIcon, peopleSeen, peopleSeen === 1 ? 'person' : 'people'],
              [MessageSquareIcon, messageCount, messageCount === 1 ? 'message' : 'messages'],
            ].map(([Icon, value, label]) => (
              <div key={label} className="rounded-2xl border border-line bg-surface p-3">
                <Icon size={16} className="mx-auto text-fg-3" />
                <p className="mt-1.5 text-lg font-semibold tabular-nums">{value}</p>
                <p className="text-[12px] text-fg-3">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {canRejoin && <button className="btn btn-primary" onClick={onRejoin}><RotateCcwIcon size={16} /> Rejoin</button>}
          <Link to="/dashboard" className={`btn ${canRejoin ? 'btn-ghost' : 'btn-primary'}`}><HouseIcon size={16} /> Back to home</Link>
          {wasInCall && !info?.removed && (
            <Link to={`/sessions?open=${meetingId}`} className="btn btn-ghost"><FileTextIcon size={16} /> View recap</Link>
          )}
        </div>
      </div>
    </main>
  );
};

export default PostCall
