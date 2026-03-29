# ─────────────────────────────────────────────────────────────────────────────
# Backend Dockerfile — Node.js + Express + Socket.IO
# Used by docker-compose.yml for local development (live-reload via ts-node-dev)
# For production builds, ts-node-dev is replaced with compiled output.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files first for layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for ts-node-dev in dev)
RUN npm install

# Copy source (in docker-compose this is overridden by a volume mount for HMR)
COPY . .

EXPOSE 3001

# Development: live-reload with ts-node-dev
# In production, swap to: node dist/server.js
CMD ["npm", "run", "dev"]
