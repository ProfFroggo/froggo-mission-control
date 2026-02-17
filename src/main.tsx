import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatingToolbar from './components/FloatingToolbar';
import './index.css';
import './accessibility.css';
import { initializeGlobalErrorHandlers } from './utils/globalErrorHandler';
import { AccessibilityProvider } from './contexts/AccessibilityContext';

// Initialize global error handlers before React renders
initializeGlobalErrorHandlers();

// Check if we're in floating toolbar mode
const isFloatingToolbar = window.location.hash === '#/floating-toolbar';

if (isFloatingToolbar) {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccessibilityProvider>
      {isFloatingToolbar ? <FloatingToolbar /> : <App />}
    </AccessibilityProvider>
  </React.StrictMode>
);
