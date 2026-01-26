#!/bin/bash
cd "$(dirname "$0")"

# Clear NODE_OPTIONS that conflict with Electron
unset NODE_OPTIONS

# Build if dist doesn't exist
if [ ! -f "dist/index.html" ]; then
  echo "Building..."
  npm run build
fi

# Compile electron if needed
if [ ! -f "dist-electron/main.js" ]; then
  npm run electron:compile
fi

# Start Electron in production mode
npx electron .
