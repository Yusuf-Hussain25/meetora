import { useId } from 'react'

// Meetora mark: a bold "M" drawn as one continuous stroke, like two people leaning in,
// with a live dot in the corner.
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
      <path d="M8.5 22.5V11.8c0-.9 1.1-1.3 1.7-.7L16 17l5.8-5.9c.6-.6 1.7-.2 1.7.7v10.7" stroke="#03140F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.6" cy="7.4" r="2.6" fill="#fff" stroke="#03140F" strokeWidth="1.4" />
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
