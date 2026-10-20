import { LogoMark } from './ui/Logo'

// Full-screen brand loader used while Clerk restores the session.
const Loader = ({ text = "Loading" }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-bg" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-5">
      <span className="rounded-[14px] animate-[pulse-ring_1.6s_ease-out_infinite]">
        <LogoMark size={52} />
      </span>
      <p className="text-sm font-medium text-fg-3">{text}</p>
    </div>
  </div>
);

export default Loader
