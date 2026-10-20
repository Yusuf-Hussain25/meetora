import { Link } from 'react-router-dom'
import { ArrowUpRightIcon, UsersIcon, InfinityIcon } from 'lucide-react'

// Monthly meeting allowance as a ring, plus the plan's participant cap.
const PlanCard = ({ stats }) => {
  const premium = stats.plan === 'premium';
  const used = stats.monthlyCount;
  const limit = stats.monthlyLimit;
  const pct = limit ? Math.min(1, used / limit) : 1;
  const R = 42, C = 2 * Math.PI * R;
  const nearLimit = limit && used / limit >= 0.8;

  return (
    <div className="card flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Your plan</p>
        <span className={`chip ${premium ? 'chip-accent' : ''}`}>{premium ? 'Premium' : 'Free'}</span>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="52" cy="52" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
          <circle
            cx="52" cy="52" r={R} fill="none"
            stroke={nearLimit ? 'var(--warning)' : 'var(--accent)'}
            strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: 'stroke-dashoffset .8s var(--ease-out)' }}
          />
        </svg>
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {used}{limit && <span className="text-lg text-fg-3"> / {limit}</span>}
          </p>
          <p className="mt-1 text-sm text-fg-2">meetings this month</p>
          {limit && <p className="mt-1 text-[12.5px] text-fg-3">{Math.max(0, limit - used)} left, resets on the 1st</p>}
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-fg-2">
        <li className="flex items-center gap-2"><UsersIcon size={15} className="text-fg-3" /> Up to {stats.maxParticipants} people per meeting</li>
        <li className="flex items-center gap-2"><InfinityIcon size={15} className="text-fg-3" /> {premium ? 'Unlimited meetings' : 'No time limit on calls'}</li>
      </ul>

      {!premium && (
        <div className="mt-auto pt-5">
          <Link to="/plans" className="btn btn-ghost btn-sm">
            Compare plans <ArrowUpRightIcon size={15} />
          </Link>
        </div>
      )}
    </div>
  );
};

export default PlanCard
