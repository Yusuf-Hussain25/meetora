import { useEffect, useRef, useState } from 'react'
import { CrownIcon, HandIcon, LinkIcon, MessageSquareIcon, MicIcon, MicOffIcon, MonitorUpIcon, SendHorizonalIcon, UserMinusIcon, VideoIcon, VideoOffIcon, VolumeXIcon, XIcon } from 'lucide-react'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import { formatTime } from '../../lib/format'

const GROUP_MS = 3 * 60000;

const Chat = ({ messages, selfId, onSend }) => {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const listRef = useRef(null);

  // Stick to the bottom unless the reader scrolled up to read history
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    if (nearBottom) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState icon={<MessageSquareIcon size={24} />} title="No messages yet" className="h-full py-6">
            Messages are visible to everyone in the call and saved with the session.
          </EmptyState>
        ) : (
          <ul className="space-y-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped = prev && prev.senderId === m.senderId && new Date(m.timestamp) - new Date(prev.timestamp) < GROUP_MS;
              const mine = m.senderId === selfId;
              return (
                <li key={m.id} className={`flex gap-2.5 ${grouped ? '' : 'pt-3'} ${mine ? 'flex-row-reverse' : ''}`}>
                  <span className="w-8 shrink-0">{!grouped && !mine && <Avatar src={m.senderImage} name={m.senderName} size={32} />}</span>
                  <div className={`flex min-w-0 max-w-[80%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!grouped && (
                      <p className="mb-1 text-[12px] text-fg-3">
                        <span className="font-semibold text-fg-2">{mine ? 'You' : m.senderName}</span> · {formatTime(m.timestamp)}
                      </p>
                    )}
                    <p className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${mine ? 'rounded-tr-md bg-accent text-[var(--accent-ink)]' : 'rounded-tl-md bg-surface-2'}`}>
                      {m.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor="chat-input">Message everyone</label>
        <textarea
          id="chat-input"
          rows={1}
          className="input max-h-32 min-h-11 resize-none py-2.5"
          placeholder="Message everyone"
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
        />
        <button type="submit" className="btn btn-primary h-11 w-11 shrink-0 p-0" disabled={!text.trim()} aria-label="Send message">
          <SendHorizonalIcon size={18} />
        </button>
      </form>
    </>
  );
};

const People = ({ people, isHost, onMute, onMuteAll, onRemove, onCopyLink }) => {
  const sorted = [...people].sort((a, b) => (b.isLocal - a.isLocal) || (b.handRaised - a.handRaised) || a.name.localeCompare(b.name));
  const hands = people.filter((p) => p.handRaised).length;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 flex gap-2 px-1">
        <button className="btn btn-ghost btn-sm flex-1" onClick={onCopyLink}><LinkIcon size={15} /> Copy invite link</button>
        {isHost && people.length > 1 && (
          <button className="btn btn-ghost btn-sm" onClick={onMuteAll} data-tip="Ask everyone to mute"><VolumeXIcon size={15} /> Mute all</button>
        )}
      </div>
      {hands > 0 && <p className="mb-2 px-2 text-[12px] font-medium text-hand">✋ {hands} raised hand{hands > 1 ? 's' : ''}</p>}
      <ul className="space-y-1">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface">
            <Avatar src={p.image} name={p.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                {p.name}
                {p.isHost && <CrownIcon size={13} className="shrink-0 text-amber-400" aria-label="Host" />}
              </p>
              <p className="text-[12px] text-fg-3">
                {p.isHost ? 'Host' : 'Participant'}
                {p.screenSharing && <span className="ml-1.5 inline-flex items-center gap-1 text-accent-text"><MonitorUpIcon size={11} /> presenting</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 text-fg-3">
              {p.handRaised && <HandIcon size={16} className="text-hand" aria-label="Hand raised" />}
              {p.videoEnabled ? <VideoIcon size={16} aria-label="Camera on" /> : <VideoOffIcon size={16} aria-label="Camera off" />}
              {p.audioEnabled ? <MicIcon size={16} aria-label="Mic on" /> : <MicOffIcon size={16} className="text-danger" aria-label="Muted" />}
              {isHost && !p.isLocal && (
                <>
                  <button className="icon-btn size-8" disabled={!p.audioEnabled} onClick={() => onMute(p.id)} aria-label={`Ask ${p.name} to mute`} data-tip="Ask to mute"><VolumeXIcon size={15} /></button>
                  <button className="icon-btn size-8 hover:!text-danger" onClick={() => onRemove(p)} aria-label={`Remove ${p.name}`} data-tip="Remove"><UserMinusIcon size={15} /></button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Chat and People in one drawer: a right column on desktop, a full-screen sheet on phones.
const SidePanel = ({ tab, onTab, onClose, chat, people }) => (
  <aside className="glass fixed inset-0 z-50 flex flex-col sm:static sm:inset-auto sm:z-auto sm:w-[360px] sm:shrink-0 sm:rounded-[24px] animate-pop-in" aria-label={tab === 'chat' ? 'Chat' : 'People'}>
    <div className="flex items-center gap-2 border-b border-line p-3">
      <div className="segmented flex-1">
        <button aria-pressed={tab === 'chat'} className="flex-1 justify-center" onClick={() => onTab('chat')}>Chat</button>
        <button aria-pressed={tab === 'people'} className="flex-1 justify-center" onClick={() => onTab('people')}>People · {people.people.length}</button>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close panel"><XIcon size={18} /></button>
    </div>
    {tab === 'chat' ? <Chat {...chat} /> : <People {...people} />}
  </aside>
);

export default SidePanel
