#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "  🐸 Clawd Dashboard"
echo "  =================="
echo ""
echo "  Opening http://localhost:5173"
echo "  Press Ctrl+C to stop"
echo ""

# Open browser after short delay
(sleep 2 && open http://localhost:5173) &

# Start dev server
npx vite --host
