#!/bin/bash
cd "$(dirname "$0")"

# Clear NODE_OPTIONS that conflict with Electron
unset NODE_OPTIONS

# Start Vite in background
npm run dev &
VITE_PID=$!

# Wait for Vite to be ready
echo "Waiting for Vite..."
while ! curl -s http://localhost:5173 > /dev/null 2>&1; do
  sleep 0.5
done
echo "Vite ready!"

# Start Electron with dev flag
ELECTRON_DEV=1 npx electron .

# Cleanup
kill $VITE_PID 2>/dev/null
