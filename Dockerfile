# Froggo Mission Control — Cloud Instance
# Each user gets their own container running the full MC stack.
# Build: docker build -t mission-control .
# Run:   docker run -v mc_data:/data -p 3000:3000 mission-control

FROM node:20-slim AS base

# System deps: native module build tools, git (for Claude CLI), ripgrep (memory search)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 make g++ git ripgrep ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
COPY package*.json ./
RUN npm ci --production --ignore-scripts

# ── App source ────────────────────────────────────────────────────────────────
COPY . .

# Rebuild native modules (better-sqlite3, keytar) for container arch
RUN npm rebuild better-sqlite3 || true
RUN npm rebuild keytar 2>/dev/null || true

# Build Next.js (production)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build --webpack

# ── MCP servers — install + build ─────────────────────────────────────────────
RUN cd tools/mission-control-db-mcp && npm ci && npx tsc || true
RUN cd tools/memory-mcp && npm ci && npx tsc || true
RUN cd tools/cron-mcp && npm ci && npx tsc || true

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV PORT=3000
ENV MISSION_CONTROL_HOME=/data/mission-control

# Persistent volume mount point
VOLUME ["/data"]

EXPOSE 3000

# Scaffold directories + start
CMD ["sh", "-c", "node bin/cli.js setup --non-interactive && npm start"]
