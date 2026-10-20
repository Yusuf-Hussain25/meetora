import { useState } from 'react'
import { CalendarPlusIcon, CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import api from '../../config/api'
import { apiError, copyText, googleCalendarLink, inviteLink } from '../../lib/meetings'
import { formatDateTime } from '../../lib/format'

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nextSlot = () => {
  const d = new Date(Date.now() + 60 * 60000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
};

const ScheduleModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState(() => {
    const slot = nextSlot();
    return { title: '', date: toDateInput(slot), time: `${pad(slot.getHours())}:${pad(slot.getMinutes())}`, description: '' };
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const when = new Date(`${form.date}T${form.time}`);
  const inPast = Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60000;

  const close = () => {
    setCreated(null);
    setForm((f) => ({ ...f, title: '', description: '' }));
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (inPast) return;
    setSaving(true);
    try {
      const { data } = await api.post('/api/meetings', {
        title: form.title.trim() || 'Team sync',
        description: form.description,
        scheduledFor: when.toISOString(),
      });
      setCreated(data.meeting);
      onCreated?.(data.meeting);
      toast.success('Meeting scheduled');
    } catch (err) {
      toast.error(apiError(err, "Couldn't schedule the meeting"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? 'Meeting scheduled' : 'Schedule a meeting'}
      subtitle={created ? formatDateTime(created.scheduledFor) : 'Pick a time and share the link. It starts when the first person joins.'}
      icon={created ? <CheckIcon size={20} /> : <CalendarPlusIcon size={20} />}
      size="sm"
      footer={created ? (
        <>
          <a className="btn btn-ghost btn-sm" href={googleCalendarLink(created)} target="_blank" rel="noreferrer">
            <ExternalLinkIcon size={15} /> Add to Google Calendar
          </a>
          <button className="btn btn-primary btn-sm" onClick={() => copyText(inviteLink(created.meetingId), 'Invite link copied')}>
            <CopyIcon size={15} /> Copy invite link
          </button>
        </>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm" onClick={close} type="button">Cancel</button>
          <button className="btn btn-primary btn-sm" form="schedule-form" type="submit" disabled={saving || inPast}>
            {saving && <span className="spinner size-4" />} Schedule
          </button>
        </>
      )}
    >
      {created ? (
        <div className="space-y-3 p-5 sm:p-6">
          <p className="text-[15px] font-semibold">{created.title}</p>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-3">
            <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg-2">{inviteLink(created.meetingId)}</code>
          </div>
          <p className="text-[13px] text-fg-3">Anyone with a Meetora account and this link can join.</p>
        </div>
      ) : (
        <form id="schedule-form" onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          <div className="field">
            <label htmlFor="s-title">Title</label>
            <input id="s-title" className="input" placeholder="Team sync" maxLength={120} value={form.title} onChange={set('title')} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="s-date">Date</label>
              <input id="s-date" type="date" className="input" min={toDateInput(new Date())} value={form.date} onChange={set('date')} required />
            </div>
            <div className="field">
              <label htmlFor="s-time">Time</label>
              <input id="s-time" type="time" className="input" value={form.time} onChange={set('time')} required />
            </div>
          </div>
          {inPast && <p className="text-[13px] text-danger" role="alert">Pick a time in the future.</p>}
          <div className="field">
            <label htmlFor="s-desc">Agenda <span className="text-fg-3">(optional)</span></label>
            <textarea id="s-desc" className="input" rows={3} maxLength={500} placeholder="What's this meeting about?" value={form.description} onChange={set('description')} />
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ScheduleModal
