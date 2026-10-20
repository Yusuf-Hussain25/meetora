import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { toggleTheme } from '../../lib/theme'

const ThemeToggle = ({ className = '' }) => {
  const theme = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      className={`icon-btn ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      data-tip={`${next[0].toUpperCase()}${next.slice(1)} theme`}
    >
      {theme === 'light' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
    </button>
  );
};

export default ThemeToggle
