import { TriangleAlertIcon } from 'lucide-react'
import Logo from './ui/Logo'

// Shown instead of a blank page when client/.env is missing required keys.
const ConfigError = ({ missing }) => (
  <main className="grid min-h-dvh place-items-center p-4">
    <div className="card w-full max-w-lg p-7 animate-fade-up">
      <Logo size={30} />
      <div className="mt-6 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
          <TriangleAlertIcon size={20} />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Meetora isn't configured yet</h1>
          <p className="mt-1 text-sm text-fg-2">
            Add these keys to <code className="font-mono text-fg">client/.env</code> and restart the dev server:
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {missing.map((key) => (
          <li key={key} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px]">{key}</li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-fg-3">Every key is explained in <code className="font-mono">client/.env.example</code>.</p>
    </div>
  </main>
);

export default ConfigError
