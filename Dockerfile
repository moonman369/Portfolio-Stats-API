# syntax=docker/dockerfile:1

# ---- Stage 1: install production dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production
# Copy only manifest + lockfile first for good layer caching:
# this layer is only rebuilt when dependencies change, not on every source edit.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 2: runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bring in prod-only node_modules from the deps stage, then the app source.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# Run as the built-in non-root user shipped with the official Node image.
USER node

EXPOSE 8000

# Alpine's Node image ships BusyBox wget (no curl) — use it for the probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "api/index.js"]
