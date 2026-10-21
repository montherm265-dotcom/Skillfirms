import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initMonitoring } from './lib/monitoring.js';
import './index.css';

// Sentry + PostHog together pull in ~580KB of JS (confirmed via a bundle
// analysis: @sentry/* in one chunk, posthog-js in another). initMonitoring()
// already dynamic-imports both so they're not in the main bundle, but calling
// it synchronously here still starts those two fetches immediately, competing
// on the network with the chunks actually needed for first paint. Neither
// SDK needs to be ready before the user sees anything, so defer the start of
// their fetch until the browser is idle (or load has fired, whichever is
// sooner) -- identifyUser/trackEvent/captureException already buffer safely
// before either SDK finishes loading.
function startMonitoringWhenIdle() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initMonitoring, { timeout: 4000 });
  } else {
    setTimeout(initMonitoring, 1);
  }
}
if (document.readyState === 'complete') {
  startMonitoringWhenIdle();
} else {
  window.addEventListener('load', startMonitoringWhenIdle, { once: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
