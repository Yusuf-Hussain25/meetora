import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClockIcon, CalendarPlusIcon, CopyIcon, ExternalLinkIcon, Trash2Icon, VideoIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../config/api'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import { apiError, copyText, googleCalendarLink, inviteLink } from '../../lib/meetings'
import { formatRelative, formatTime } from '../../lib/format'

const STARTABLE_MS = 15 * 60000; // "Start" is highlighted from 15 minutes before

const UpcomingList = ({ meetings, onSchedule, onChanged }) => {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/meetings/${cancelling.meetingId}`);
      toast.success('Meeting cancelled');
      setCancelling(null);
      onChanged?.();
    } catch (err) {
      toast.error(apiError(err, "Couldn't cancel the meeting"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Upcoming</p>
        <button className="btn btn-ghost btn-sm" onClick={onSchedule}><CalendarPlusIcon size={15} /> Schedule</button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState icon={<CalendarClockIcon size={26} />} title="Nothing scheduled" className="flex-1 py-10">
          Plan your next meeting and share the link ahead of time.
        </EmptyState>
      ) : (
        <ul className="mt-4 space-y-2">
          {meetings.map((m) => {
            const when = new Date(m.scheduledFor);
            const soon = when.getTime() - Date.now() < STARTABLE_MS;
            return (
              <li key={m.meetingId} className="group flex items-center gap-3.5 rounded-2xl border border-transparent p-2.5 transition-colors hover:border-line hover:bg-surface">
                <div className={`grid size-13 shrink-0 place-items-center rounded-xl text-center leading-none ${soon ? 'bg-accent text-[var(--accent-ink)]' : 'bg-surface-2'}`}>
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide opacity-75">{when.toLocaleDateString([], { month: 'short' })}</p>
                    <p className="mt-1 text-lg font-semibold">{when.getDate()}</p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">{m.title}</p>
                  <p className="mt-0.5 truncate text-[13px] text-fg-3">
                    {when.toLocaleDateString([], { weekday: 'short' })} · {formatTime(when)} · <span className={soon ? 'font-medium text-accent-text' : ''}>{formatRelative(when)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button className="icon-btn size-9" onClick={() => copyText(inviteLink(m.meetingId), 'Invite link copied')} aria-label={`Copy invite link for ${m.title}`} data-tip="Copy link">
                    <CopyIcon size={16} />
                  </button>
                  <a className="icon-btn hidden size-9 sm:inline-grid" href={googleCalendarLink(m)} target="_blank" rel="noreferrer" aria-label={`Add ${m.title} to Google Calendar`} data-tip="Add to calendar">
                    <ExternalLinkIcon size={16} />
                  </a>
                  <button className="icon-btn size-9 hover:!text-danger" onClick={() => setCancelling(m)} aria-label={`Cancel ${m.title}`} data-tip="Cancel">
                    <Trash2Icon size={16} />
                  </button>
                  <button className={`btn btn-sm ml-1 ${soon ? 'btn-primary' : 'btn-ghost'}`} onClick={() => navigate(`/meeting/${m.meetingId}`)}>
                    <VideoIcon size={15} /> Start
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this meeting?"
        subtitle={cancelling?.title}
        icon={<Trash2Icon size={20} />}
        size="sm"
        footer={(
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setCancelling(null)}>Keep it</button>
            <button className="btn btn-danger btn-sm" onClick={cancel} disabled={busy}>{busy && <span className="spinner size-4" />} Cancel meeting</button>
          </>
        )}
      >
        <p className="p-5 text-sm text-fg-2 sm:p-6">The invite link will stop working. This can't be undone.</p>
      </Modal>
    </div>
  );
};

export default UpcomingList
