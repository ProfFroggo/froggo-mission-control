'use client';

import dynamic from 'next/dynamic';

// Import bridge for window.clawdbot polyfill — guarded by typeof window
import '../src/lib/bridge';

// Dynamic import with ssr: false to avoid window-is-not-defined errors
// from Electron-ported code that accesses window/localStorage at module level
const App = dynamic(() => import('../src/App'), { ssr: false });

export default function Home() {
  return <App />;
}
