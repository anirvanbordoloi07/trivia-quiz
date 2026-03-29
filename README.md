# Trivia Quiz

A real-time, 2-player trivia game where each player writes questions for the other. The frontend is a React + Vite app, and the backend is a Node.js + Socket.IO server that manages live game state, timers, scoring, and turn rotation.

## Stack

- Frontend: React 19, Vite, Tailwind CSS, Zustand, Socket.IO client
- Backend: Node.js, Express, Socket.IO, TypeScript
- Hosting:
  - Frontend on Netlify
  - Backend on Render

## Repo Structure

```text
.
├── backend
├── frontend
├── netlify.toml
├── render.yaml
└── start-dev.sh
```

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Create local env files

Backend:

```bash
cp backend/.env.example backend/.env
```

Frontend:

```bash
cp frontend/.env.example frontend/.env
```

### 3. Run locally

From the repo root:

```bash
./start-dev.sh
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## Deployment

### Render backend

Create a new Render Web Service from this repo.

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Plan: `Free`

Set these environment variables in Render:

- `CLIENT_ORIGIN=https://YOUR-NETLIFY-SITE.netlify.app`
- `PRODUCTION_URL=https://YOUR-NETLIFY-SITE.netlify.app`

After the first deploy, Render will give you a backend URL like:

`https://trivia-quiz-backend.onrender.com`

### Netlify frontend

Create a new Netlify site from this repo.

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`

Set this environment variable in Netlify:

- `VITE_SOCKET_URL=https://YOUR-RENDER-BACKEND.onrender.com`

Because this is a single-page app, `netlify.toml` already includes the redirect needed for `/join/:gameId`.

### Recommended deployment order

1. Deploy the backend on Render and copy the Render URL.
2. Deploy the frontend on Netlify using the Render URL as `VITE_SOCKET_URL`.
3. Update Render `CLIENT_ORIGIN` and `PRODUCTION_URL` to your final Netlify URL if needed.
4. Redeploy Render once after the Netlify URL is finalized.

## Environment Variables

### Backend

- `PORT`: optional, Render usually injects this automatically
- `CLIENT_ORIGIN`: frontend origin allowed for Socket.IO and share links
- `PRODUCTION_URL`: additional allowed origin for production

### Frontend

- `VITE_SOCKET_URL`: full Render backend URL

## Features Included

- Create and join a 2-player game by link
- Real-time turn-based question authoring and answering
- Server-enforced answer timer and synchronized reveal countdown
- Live scoreboard
- End-game winner screen
- Play again flow
- Round-by-round review log
- Result sharing via Web Share API or clipboard fallback

## Notes

- The backend stores active games in memory. On Render free tier, the service may spin down after inactivity.
- Reconnection and persistent accounts are not included in this version.
