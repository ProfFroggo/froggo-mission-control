import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './accessibility.css';
import { initializeGlobalErrorHandlers } from './utils/globalErrorHandler';
import { AccessibilityProvider } from './contexts/AccessibilityContext';

// Initialize global error handlers before React renders
initializeGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccessibilityProvider>
      <App />
    </AccessibilityProvider>
  </React.StrictMode>
);
