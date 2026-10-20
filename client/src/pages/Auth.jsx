import { useState } from 'react'
import { SignIn, SignUp, useClerk, useUser } from '@clerk/react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CaptionsIcon, HandIcon, HistoryIcon, MonitorUpIcon, ShieldCheckIcon, SparklesIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from '../components/ui/Logo'
import ThemeToggle from '../components/ui/ThemeToggle'
import CallPreview from '../components/auth/CallPreview'

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

const FEATURES = [
  { icon: CaptionsIcon, title: 'Live captions', text: 'Speech turns into subtitles everyone sees, saved as a transcript.' },
  { icon: HandIcon, title: 'Reactions & hands', text: 'Raise a hand or send a reaction without breaking the flow.' },
  { icon: MonitorUpIcon, title: 'Screen sharing', text: 'Present a tab, window or screen in one click.' },
  { icon: HistoryIcon, title: 'Session recap', text: 'Who joined, for how long, the chat and the transcript.' },
];

// Clerk renders its own form; we hide its header and frame it in our glass card.
const embedded = {
  elements: {
    header: { display: 'none' },
    rootBox: { width: '100%' },
  },
};

const Auth = ({ mode = 'login' }) => {
  const isRegister = mode === 'register';
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  if (isLoaded && isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  const signInAsDemo = async () => {
    if (!clerk.loaded) return;
    setDemoLoading(true);
    try {
      const attempt = await clerk.client.signIn.create({ identifier: DEMO_EMAIL, password: DEMO_PASSWORD });
      if (attempt.status !== 'complete') {
        throw new Error('The demo account needs an extra verification step. Sign in with the form instead.');
      }
      await clerk.setActive({ session: attempt.createdSessionId });
      toast.success('Signed in to the demo account');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.errors?.[0]?.longMessage || err.message || 'Could not open the demo account');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo size={30} />
        <ThemeToggle />
      </header>

      {/* Mobile order: headline, auth card, preview. Desktop: hero left, card right. */}
      <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-14 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-x-14 lg:pt-6">
        {/* Brand hero */}
        <section className="animate-fade-up lg:col-start-1 lg:row-start-1">
            <span className="chip chip-accent"><SparklesIcon size={13} /> Meetora 2.0 is here</span>
            <h1 className="mt-5 text-[40px] leading-[1.04] font-semibold tracking-[-0.04em] sm:text-[54px]">
              Meetings that feel like<br className="hidden sm:block" /> <span className="gradient-text">you're in the room.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-fg-2 sm:text-lg">
              Crisp peer-to-peer video with live captions, reactions, screen sharing and a recap of every call. No downloads, just a link.
            </p>
        </section>

        {/* Auth card */}
        <section className="animate-fade-up [animation-delay:.08s] lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="card mx-auto w-full max-w-[460px] p-5 shadow-deep sm:p-7">
            <div className="segmented mb-6 w-full" role="group" aria-label="Choose log in or sign up">
              <button aria-pressed={!isRegister} className="flex-1 justify-center" onClick={() => navigate('/login', { replace: true })}>Log in</button>
              <button aria-pressed={isRegister} className="flex-1 justify-center" onClick={() => navigate('/register', { replace: true })}>Sign up</button>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-1 text-sm text-fg-3">
              {isRegister ? 'Start your first meeting in under a minute.' : 'Log in to start or join a meeting.'}
            </p>

            <div className="mt-5">
              {isRegister ? (
                <SignUp routing="path" path="/register" signInUrl="/login" fallbackRedirectUrl="/dashboard" appearance={embedded} />
              ) : (
                <SignIn routing="path" path="/login" signUpUrl="/register" fallbackRedirectUrl="/dashboard" appearance={embedded} />
              )}
            </div>

            {DEMO_EMAIL && DEMO_PASSWORD && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-fg-3">
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </div>
                <button className="btn btn-ghost btn-block" onClick={signInAsDemo} disabled={demoLoading || !isLoaded}>
                  {demoLoading ? <span className="spinner" /> : <SparklesIcon size={17} className="text-accent-text" />}
                  {demoLoading ? 'Opening demo…' : 'Explore with a demo account'}
                </button>
              </>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-fg-3">
              <ShieldCheckIcon size={13} /> Calls are peer-to-peer and encrypted by WebRTC
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-8 animate-fade-up [animation-delay:.12s] lg:col-start-1 lg:row-start-2">
          <CallPreview />

          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card flex gap-3 rounded-[20px] p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon size={17} /></span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-fg-3">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default Auth
