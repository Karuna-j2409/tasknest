# syntax=docker/dockerfile:1
# =========================================================
# TaskNest – production Docker image
# Build:  docker build -t tasknest:1.0 .
# Run:    docker run -d -p 3000:3000 -v tasknest-data:/app/data --name tasknest tasknest:1.0
# =========================================================

# ---------- Stage 1: install production dependencies ----------
FROM node:24-alpine AS deps
WORKDIR /app

# Copy only the dependency files first, so this layer is cached
# and `npm ci` re-runs only when dependencies change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: the final, small runtime image ----------
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/tasks.db

# App code + the dependencies from stage 1 (no dev/test tools)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# Folder for the SQLite database (mount a volume here to keep data),
# owned by the built-in non-root "node" user
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000

# Docker marks the container "unhealthy" if /health stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/health" || exit 1

CMD ["node", "src/server.js"]
