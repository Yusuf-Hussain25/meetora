import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import { useTheme } from './hooks/useTheme'
import { clerkAppearance } from './lib/clerkAppearance'
import ConfigError from './components/ConfigError'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_BASE_URL;

const missing = [
  !PUBLISHABLE_KEY?.startsWith('pk_') && 'VITE_CLERK_PUBLISHABLE_KEY',
  !API_URL && 'VITE_BASE_URL',
].filter(Boolean);

const Root = () => {
  const theme = useTheme();
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/login" appearance={clerkAppearance(theme)}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  );
};

createRoot(document.getElementById('root')).render(
  missing.length ? <ConfigError missing={missing} /> : <Root />
)
