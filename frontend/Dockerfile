# ─────────────────────────────────────────────────────────────────────────────
# Frontend Dockerfile — React 19 + Vite dev server
# Used by docker-compose.yml for local development with HMR.
# For production, build with `npm run build` and serve the dist/ folder via
# Vercel (no Dockerfile needed for deployment).
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

RUN npm install

# Copy rest of the project (overridden by volume mounts in docker-compose for HMR)
COPY . .

EXPOSE 5173

# Vite dev server — bind to 0.0.0.0 so Docker port mapping works
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
