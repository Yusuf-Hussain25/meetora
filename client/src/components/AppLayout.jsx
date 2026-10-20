import { NavLink, Outlet, Link } from 'react-router-dom'
import { UserButton } from '@clerk/react'
import { GemIcon, HistoryIcon, HouseIcon, VideoIcon } from 'lucide-react'
import Logo from './ui/Logo'
import ThemeToggle from './ui/ThemeToggle'
import { useStartMeeting } from '../hooks/useStartMeeting'

const NAV = [
  { to: '/dashboard', label: 'Home', icon: HouseIcon },
  { to: '/sessions', label: 'Sessions', icon: HistoryIcon },
  { to: '/plans', label: 'Plans', icon: GemIcon },
];

const AppLayout = () => {
  const { start, starting } = useStartMeeting();

  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-panel-solid focus:px-3 focus:py-2">Skip to content</a>

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex h-16 max-w-7xl items-center gap-2 rounded-[20px] px-3 shadow-soft sm:px-4">
          <Link to="/dashboard" aria-label="Meetora home" className="rounded-lg">
            <Logo size={30} />
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'
                  }`}
              >
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button className="btn btn-primary btn-sm hidden sm:inline-flex" onClick={() => start()} disabled={starting}>
              {starting ? <span className="spinner size-4" /> : <VideoIcon size={16} />}
              New meeting
            </button>
            <ThemeToggle />
            <span className="grid size-9 place-items-center">
              <UserButton appearance={{ elements: { avatarBox: { width: 34, height: 34 } } }} />
            </span>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-3 pt-6 sm:px-6 sm:pt-8">
        <Outlet />
      </main>

      {/* Phone tab bar */}
      <nav className="glass fixed inset-x-3 bottom-3 z-40 grid h-16 grid-cols-3 rounded-[20px] px-2 shadow-deep md:hidden" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors ${
                isActive ? 'text-accent-text' : 'text-fg-3'
              }`}
          >
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout
