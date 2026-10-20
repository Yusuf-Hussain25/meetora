import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import ConfigError from './components/ConfigError'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_BASE_URL;

const missing = [
  !PUBLISHABLE_KEY?.startsWith('pk_') && 'VITE_CLERK_PUBLISHABLE_KEY',
  !API_URL && 'VITE_BASE_URL',
].filter(Boolean);

createRoot(document.getElementById('root')).render(
  missing.length ? <ConfigError missing={missing} /> : <Root publishableKey={PUBLISHABLE_KEY} />
)
