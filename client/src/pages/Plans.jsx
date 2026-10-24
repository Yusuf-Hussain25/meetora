import { useEffect, useState } from 'react'
import { PricingTable } from '@clerk/react'
import { CheckIcon, GemIcon, SparklesIcon } from 'lucide-react'
import api from '../config/api'

// Clerk Billing is optional: set VITE_CLERK_BILLING=true once plans exist in the Clerk dashboard
const BILLING_ENABLED = import.meta.env.VITE_CLERK_BILLING === 'true';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    blurb: 'Everything you need for small teams.',
    features: ['30 meetings a month', 'Up to 10 people per meeting', 'No time limit on calls', 'Live captions & transcripts', 'Screen sharing, reactions, hands', 'Full session history'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$12',
    per: '/ month',
    blurb: 'For teams that live in meetings.',
    features: ['Unlimited meetings', 'Up to 100 people per meeting', 'Everything in Free', 'Priority support'],
  },
];

const Plans = () => {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api.get('/api/meetings/stats').then(({ data }) => setPlan(data.plan)).catch(() => setPlan('free'));
  }, []);

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="text-center">
        <span className="chip chip-accent"><GemIcon size={13} /> Plans</span>
        <h1 className="mt-4 text-[32px] leading-tight font-semibold tracking-[-0.035em] sm:text-[42px]">Simple plans, <span className="gradient-text">no time limits.</span></h1>
        <p className="mx-auto mt-3 max-w-lg text-fg-2">Every plan has unlimited call length and every feature. Premium removes the monthly cap and fits bigger rooms.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2">
        {PLANS.map((p) => {
          const current = plan === p.id;
          const featured = p.id === 'premium';
          return (
            <div key={p.id} className={`card relative flex flex-col p-6 sm:p-7 ${featured ? 'shadow-glow' : ''}`}>
              {featured && <span className="chip chip-accent absolute right-5 top-5"><SparklesIcon size={12} /> Most popular</span>}
              <p className="text-lg font-semibold">{p.name}</p>
              <p className="mt-1 text-sm text-fg-3">{p.blurb}</p>
              <p className="mt-6 text-4xl font-semibold tracking-tight">{p.price}<span className="text-base font-normal text-fg-3"> {p.per || 'forever'}</span></p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"><CheckIcon size={12} strokeWidth={3} /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-7">
                {plan === null ? (
                  <div className="skeleton h-11 w-full" />
                ) : current ? (
                  <p className="flex h-11 items-center justify-center rounded-xl border border-line text-sm font-medium text-fg-2">Your current plan</p>
                ) : featured && BILLING_ENABLED ? (
                  <a href="#upgrade" className="btn btn-primary btn-block">Upgrade to Premium</a>
                ) : featured ? (
                  <p className="text-center text-[13px] text-fg-3">Upgrades open once billing is enabled for this workspace.</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {BILLING_ENABLED && (
        <section id="upgrade" className="card mt-8 p-5 sm:p-7">
          <h2 className="mb-5 text-lg font-semibold">Upgrade</h2>
          <PricingTable />
        </section>
      )}
    </div>
  );
};

export default Plans
