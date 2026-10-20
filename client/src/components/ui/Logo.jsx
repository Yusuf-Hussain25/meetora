import { useId } from 'react'

// Meetora mark: two rings that meet, the bright overlap is the meeting point,
// with a small spark for the AI features.
export const LogoMark = ({ size = 32 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE7B7" />
          <stop offset=".45" stopColor="#10B981" />
          <stop offset="1" stopColor="#0891B2" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill={`url(#${id}-g)`} />
      <path d="M16 11.3a6.3 6.3 0 0 1 0 9.4 6.3 6.3 0 0 1 0-9.4z" fill="#fff" />
      <circle cx="12.5" cy="16" r="6.3" stroke="#03140F" strokeWidth="2.8" />
      <circle cx="19.5" cy="16" r="6.3" stroke="#03140F" strokeWidth="2.8" />
      <path d="M26 3.6l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" fill="#fff" />
    </svg>
  );
};

const Logo = ({ size = 32, showText = true, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} />
    {showText && (
      <span className="font-semibold text-fg" style={{ fontSize: size * 0.62, letterSpacing: '-0.035em' }}>
        Meetora
      </span>
    )}
  </span>
);

export default Logo
