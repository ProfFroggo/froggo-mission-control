#!/bin/bash
# Unified build + deploy script for Froggo Dashboard

set -e

echo "🔨 Building Froggo..."
cd ~/froggo-dashboard
npm run electron:build

echo "🚀 Deploying to /Applications..."
pkill -9 -f Froggo 2>/dev/null || true
sleep 1
rm -rf /Applications/Froggo.app
cp -R release/mac-arm64/Froggo.app /Applications/

echo "🎉 Launching Froggo..."
open /Applications/Froggo.app

echo "✅ Deploy complete!"
