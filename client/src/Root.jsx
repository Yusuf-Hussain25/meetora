import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import App from './App.jsx'
import { useTheme } from './hooks/useTheme'
import { clerkAppearance } from './lib/clerkAppearance'

// Clerk + router, with Clerk's components following the current theme
const Root = ({ publishableKey }) => {
  const theme = useTheme();
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/login" appearance={clerkAppearance(theme)}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  );
};

export default Root
