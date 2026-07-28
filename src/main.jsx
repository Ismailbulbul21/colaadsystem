import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import App from './App'
import { isConfigured, missingConfigKeys } from './lib/supabaseClient'
import ConfigError from './components/feedback/ConfigError'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import ErrorBoundary from './components/feedback/ErrorBoundary'

// Bundled locally so the interface never waits on a font CDN.
import '@fontsource-variable/inter'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// Stop here if the build has no database settings, rather than letting every
// provider fail one after another against a placeholder client.
if (!isConfigured) {
  root.render(
    <React.StrictMode>
      <ConfigError missing={missingConfigKeys} />
    </React.StrictMode>,
  )
} else {
  root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Language sits above auth so the login screen is Somali already */}
        <LanguageProvider>
          <AuthProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3500,
                className: 'text-sm',
                style: {
                  background: '#0F2C59',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '10px 14px',
                },
                success: { iconTheme: { primary: '#34D399', secondary: '#0F2C59' } },
                error: {
                  duration: 5000,
                  style: { background: '#B91C1C', color: '#fff' },
                  iconTheme: { primary: '#fff', secondary: '#B91C1C' },
                },
              }}
            />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
  )
}
