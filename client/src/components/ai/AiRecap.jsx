import { useEffect, useState } from 'react'
import { CheckCircle2Icon, CircleHelpIcon, ListChecksIcon, MailIcon, RefreshCwIcon, SparklesIcon, StarIcon } from 'lucide-react'
import api from '../../config/api'
import Avatar from '../ui/Avatar'
import { AiBadge, AiOff, AiThinking, AskMeeting } from './AiPieces'
import { useAiStatus } from '../../hooks/useAiStatus'
import { apiError, copyText } from '../../lib/meetings'
import { formatDateTime, formatDuration, formatRelative, meetingDuration } from '../../lib/format'

const followUpEmail = (session, recap) => [
  `Subject: Recap: ${session.title} (${formatDateTime(session.startedAt || session.createdAt)})`,
  '',
  'Hi all,',
  '',
  'Thanks for joining. Here is a quick recap.',
  '',
  recap.summary,
  recap.decisions.length ? `\nDecisions:\n${recap.decisions.map((d) => `- ${d}`).join('\n')}` : '',
  recap.actionItems.length ? `\nAction items:\n${recap.actionItems.map((a) => `- ${a.task} (${a.owner}${a.due ? `, ${a.due}` : ''})`).join('\n')}` : '',
  recap.openQuestions.length ? `\nOpen questions:\n${recap.openQuestions.map((q) => `- ${q}`).join('\n')}` : '',
  '',
  `Meeting length: ${formatDuration(meetingDuration(session))}`,
].filter((line) => line !== null).join('\n');

const Section = ({ icon: Icon, title, children }) => (
  <section>
    <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-fg-2"><Icon size={15} className="text-accent-text" /> {title}</h4>
    {children}
  </section>
);

// AI recap of a finished (or running) meeting, plus "Ask this meeting"
const AiRecap = ({ session }) => {
  const status = useAiStatus();
  const [recap, setRecap] = useState(undefined); // undefined = loading, null = none yet
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasSource = session.transcript.length + session.messages.length > 0;
  const peopleByName = Object.fromEntries(session.participants.map((p) => [p.name, p]));

  useEffect(() => {
    let alive = true;
    api.get(`/api/ai/meetings/${session.meetingId}/recap`)
      .then(({ data }) => alive && setRecap(data.recap))
      .catch(() => alive && setRecap(null));
    return () => { alive = false; };
  }, [session.meetingId]);

  const generate = async (refresh = false) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/api/ai/meetings/${session.meetingId}/recap`, { refresh });
      setRecap(data.recap);
    } catch (err) {
      setError(apiError(err, "Couldn't create the recap"));
    } finally {
      setBusy(false);
    }
  };

  if (status === null || recap === undefined) return <div className="space-y-3"><div className="skeleton h-20 w-full" /><div className="skeleton h-4 w-2/3" /></div>;
  if (!status.enabled && !recap) return <AiOff />;

  if (!hasSource && !recap) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <SparklesIcon size={22} className="mx-auto text-accent-text" />
        <p className="mt-3 text-sm font-semibold">Nothing for the AI to read yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-fg-3">The recap is written from live captions and chat. Turn on captions (press L) in your next call.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!recap ? (
        busy ? <AiThinking label="Writing your recap" /> : (
          <div className="relative overflow-hidden rounded-[22px] border border-accent/25 bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 p-6">
            <AiBadge>AI recap</AiBadge>
            <p className="mt-3 text-[17px] font-semibold tracking-tight">Turn this meeting into a recap</p>
            <p className="mt-1 max-w-md text-sm text-fg-2">Summary, decisions, action items with owners and open questions, written from the captions and chat.</p>
            <button className="btn btn-primary mt-5" onClick={() => generate(false)}><SparklesIcon size={16} /> Generate recap</button>
          </div>
        )
      ) : (
        <div className="space-y-6 animate-fade-up">
          <div className="rounded-[22px] border border-accent/25 bg-gradient-to-br from-emerald-400/10 via-transparent to-cyan-400/10 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge>AI recap</AiBadge>
              {recap.topics.map((t) => <span key={t} className="chip h-6 text-[11.5px]">{t}</span>)}
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">{recap.summary}</p>
            <p className="mt-3 text-[12px] text-fg-3">
              Generated {formatRelative(recap.generatedAt)}{recap.stale && ' · new captions or chat since then'}
            </p>
          </div>

          {recap.highlights.length > 0 && (
            <Section icon={StarIcon} title="Highlights">
              <ul className="space-y-1.5 text-[14px]">
                {recap.highlights.map((h, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{h}</li>)}
              </ul>
            </Section>
          )}

          {recap.decisions.length > 0 && (
            <Section icon={CheckCircle2Icon} title="Decisions">
              <ul className="space-y-1.5 text-[14px]">
                {recap.decisions.map((d, i) => <li key={i} className="flex gap-2"><CheckCircle2Icon size={15} className="mt-0.5 shrink-0 text-ok" />{d}</li>)}
              </ul>
            </Section>
          )}

          {recap.actionItems.length > 0 && (
            <Section icon={ListChecksIcon} title="Action items">
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {recap.actionItems.map((a, i) => {
                  const person = peopleByName[a.owner];
                  return (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid size-5 shrink-0 place-items-center rounded-md border border-line-strong" aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-[14px]">{a.task}</span>
                      {a.due && <span className="chip h-6 text-[11.5px]">{a.due}</span>}
                      <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-fg-2">
                        {a.owner !== 'Unassigned' && <Avatar src={person?.image} name={a.owner} size={22} />}
                        {a.owner}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {recap.openQuestions.length > 0 && (
            <Section icon={CircleHelpIcon} title="Open questions">
              <ul className="space-y-1.5 text-[14px] text-fg-2">
                {recap.openQuestions.map((q, i) => <li key={i}>• {q}</li>)}
              </ul>
            </Section>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => copyText(followUpEmail(session, recap), 'Follow-up email copied')}><MailIcon size={15} /> Copy follow-up email</button>
            {status.enabled && (
              <button className="btn btn-ghost btn-sm" onClick={() => generate(true)} disabled={busy}>
                {busy ? <span className="spinner size-4" /> : <RefreshCwIcon size={15} />} Regenerate
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}

      {status.enabled && hasSource && (
        <Section icon={SparklesIcon} title="Ask this meeting">
          <AskMeeting meetingId={session.meetingId} />
        </Section>
      )}
    </div>
  );
};

export default AiRecap
