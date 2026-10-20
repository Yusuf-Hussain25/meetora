import { useState } from 'react'
import { ArrowUpIcon, QuoteIcon, SparklesIcon } from 'lucide-react'
import api from '../../config/api'
import { apiError } from '../../lib/meetings'

// Gradient sparkle chip used to mark AI-made content
export const AiBadge = ({ children = 'AI' }) => (
  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 px-2.5 text-[11.5px] font-semibold text-accent-text ring-1 ring-accent/25">
    <SparklesIcon size={12} /> {children}
  </span>
);

// Shown when the server has no AI key configured
export const AiOff = ({ compact = false }) => (
  <div className={`rounded-2xl border border-dashed border-line-strong bg-surface text-center ${compact ? 'p-4' : 'p-6'}`}>
    <span className="mx-auto grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text"><SparklesIcon size={18} /></span>
    <p className="mt-3 text-sm font-semibold">AI features are off</p>
    <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-fg-3">
      Add <code className="font-mono text-fg-2">ANTHROPIC_API_KEY</code> or <code className="font-mono text-fg-2">GEMINI_API_KEY</code> to <code className="font-mono text-fg-2">server/.env</code> to turn on recaps, Q&amp;A and catch-up.
    </p>
  </div>
);

export const AiThinking = ({ label = 'Thinking' }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-fg-2" role="status">
    <span className="relative grid size-8 place-items-center rounded-lg bg-accent-soft text-accent-text">
      <SparklesIcon size={16} className="animate-pulse" />
    </span>
    {label}…
  </div>
);

const SUGGESTIONS = ['What did we decide?', 'Who owns the next steps?', 'What questions are still open?'];

// "Ask this meeting": answers from the transcript and chat, with supporting quotes
export const AskMeeting = ({ meetingId, compact = false }) => {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const ask = async (q = question) => {
    const text = q.trim();
    if (!text || asking) return;
    setQuestion(text);
    setAsking(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post(`/api/ai/meetings/${meetingId}/ask`, { question: text });
      setResult({ question: text, ...data.answer });
    } catch (err) {
      setError(apiError(err, "Couldn't answer that"));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative">
        <label htmlFor={`ask-${meetingId}`} className="sr-only">Ask about this meeting</label>
        <input
          id={`ask-${meetingId}`}
          className="input h-12 pr-12"
          placeholder="Ask anything about this meeting…"
          value={question}
          maxLength={300}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="btn btn-primary absolute right-1.5 top-1.5 h-9 w-9 p-0" disabled={!question.trim() || asking} aria-label="Ask">
          {asking ? <span className="spinner size-4" /> : <ArrowUpIcon size={17} />}
        </button>
      </form>

      {!result && !asking && !error && (
        <div className={`mt-3 flex flex-wrap gap-2 ${compact ? '' : ''}`}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip hover:border-line-strong hover:text-fg" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}

      {asking && <div className="mt-3"><AiThinking label="Reading the meeting" /></div>}
      {error && <p className="mt-3 text-[13px] text-danger" role="alert">{error}</p>}

      {result && (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 animate-fade-up">
          <p className="text-[12px] font-medium text-fg-3">{result.question}</p>
          <p className={`mt-1.5 text-[14.5px] leading-relaxed ${result.found ? 'text-fg' : 'text-fg-2'}`}>{result.answer}</p>
          {result.quotes?.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.quotes.map((q, i) => (
                <li key={i} className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                  <QuoteIcon size={13} className="mt-0.5 shrink-0 text-accent-text" />
                  <span><span className="font-semibold">{q.speaker}:</span> <span className="text-fg-2">“{q.text}”</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
