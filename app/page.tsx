'use client';

import '../src/lib/bridge'; // Polyfill window.clawdbot before App renders
import App from '../src/App';

export default function Home() {
  return <App />;
}
