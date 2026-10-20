import { useState } from 'react'
import { BellIcon, HistoryIcon, SparklesIcon } from 'lucide-react'
import api from '../../config/api'
import { AiBadge, AiOff, AiThinking, AskMeeting } from './AiPieces'
import { useAiStatus } from '../../hooks/useAiStatus'
import { apiError } from '../../lib/meetings'

const WINDOWS = [5, 15, 30];

// In-call AI: "Catch me up" on the last few minutes, and questions about the meeting so far
const CatchUpPanel = ({ meetingId, captionsOn }) => {
  const status = useAiStatus();
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const catchUp = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post(`/api/ai/meetings/${meetingId}/catchup`, { minutes });
      setResult(data.catchUp);
    } catch (err) {
      setError(apiError(err, "Couldn't catch you up"));
    } finally {
      setBusy(false);
    }
  };

  if (status === null) return <div className="p-4"><div className="skeleton h-24 w-full" /></div>;
  if (!status.enabled) return <div className="p-4"><AiOff compact /></div>;

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      <section className="rounded-[20px] border border-accent/25 bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 p-4">
        <AiBadge>Catch me up</AiBadge>
        <p className="mt-2.5 text-[14px] font-semibold">Missed something?</p>
        <p className="mt-0.5 text-[12.5px] text-fg-3">A quick summary of the last few minutes, plus anything said to you.</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="segmented" role="group" aria-label="How far back">
            {WINDOWS.map((m) => <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m}m</button>)}
          </div>
          <button className="btn btn-primary btn-sm flex-1" onClick={catchUp} disabled={busy}>
            {busy ? <span className="spinner size-4" /> : <SparklesIcon size={15} />} Catch me up
          </button>
        </div>
      </section>

      {busy && <AiThinking label="Catching up" />}
      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}

      {result && (
        <section className="space-y-3 animate-fade-up">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-fg-3"><HistoryIcon size={13} /> Last {result.minutes} minutes</p>
          <p className="text-[14px] leading-relaxed">{result.summary}</p>
          {result.points.length > 0 && (
            <ul className="space-y-1.5 text-[13.5px] text-fg-2">
              {result.points.map((p, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />{p}</li>)}
            </ul>
          )}
          {result.forYou.length > 0 && (
            <div className="rounded-2xl border border-hand/40 bg-hand/10 p-3">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><BellIcon size={13} className="text-hand" /> For you</p>
              <ul className="mt-1.5 space-y-1 text-[13px]">{result.forYou.map((f, i) => <li key={i}>• {f}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section>
        <p className="mb-2 text-[13px] font-semibold text-fg-2">Ask about this meeting</p>
        <AskMeeting meetingId={meetingId} compact />
      </section>

      {!captionsOn && (
        <p className="text-[12px] text-fg-3">Tip: the AI reads live captions and chat. Turn on captions (L) so speech counts too.</p>
      )}
    </div>
  );
};

export default CatchUpPanel
