import { useState } from 'react'
import { formatDuration } from '../../lib/format'

const dayLabel = (iso, opts) => new Date(`${iso}T12:00:00`).toLocaleDateString([], opts);

// Minutes in meetings per day for the last 7 days. One series, so the title names it (no legend).
const ActivityChart = ({ activity = [] }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(60, ...activity.map((d) => d.minutes));
  const total = activity.reduce((sum, d) => sum + d.minutes, 0);
  const meetings = activity.reduce((sum, d) => sum + d.meetings, 0);
  const todayIso = activity.at(-1)?.day;

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Time in meetings · last 7 days</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight">{formatDuration(total * 60000)}</p>
        </div>
        <p className="text-sm text-fg-3">{meetings} meeting{meetings === 1 ? '' : 's'} this week</p>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="relative flex min-h-40 flex-1 items-end gap-2 sm:gap-3">
          {/* recessive gridlines at 0, 50% and 100% of the scale */}
          {[0, 50, 100].map((t) => (
            <span key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${t}%` }} />
          ))}
          {activity.map((d, i) => {
            const h = d.minutes ? Math.max(3, (d.minutes / max) * 100) : 0;
            const active = hover === i || d.day === todayIso;
            return (
              // the hit target is the whole column; the bar itself stays thin
              <div
                key={d.day}
                className="relative flex h-full flex-1 items-end justify-center outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${dayLabel(d.day, { weekday: 'long', day: 'numeric', month: 'short' })}: ${d.meetings} meetings, ${d.minutes} minutes`}
              >
                <div
                  className={`w-full max-w-9 rounded-t-[4px] transition-all duration-500 ${active ? 'bg-accent' : 'bg-accent/50'}`}
                  style={{ height: d.minutes ? `${h}%` : 2, opacity: d.minutes ? 1 : 0.4 }}
                />
                {hover === i && (
                  <div className="absolute z-10 w-max rounded-xl border border-line-strong bg-panel-solid px-3 py-2 text-xs shadow-soft animate-pop-in" style={{ bottom: `calc(${h}% + 8px)` }}>
                    <p className="font-semibold text-fg">{dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="mt-0.5 text-fg-2">{d.meetings} meeting{d.meetings === 1 ? '' : 's'} · {formatDuration(d.minutes * 60000)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2 sm:gap-3">
          {activity.map((d) => (
            <span key={d.day} className={`flex-1 text-center text-xs ${d.day === todayIso ? 'font-semibold text-fg' : 'text-fg-3'}`}>
              {d.day === todayIso ? 'Today' : dayLabel(d.day, { weekday: 'short' })}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Minutes in meetings per day</caption>
        <thead><tr><th>Day</th><th>Meetings</th><th>Minutes</th></tr></thead>
        <tbody>
          {activity.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.meetings}</td><td>{d.minutes}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityChart
