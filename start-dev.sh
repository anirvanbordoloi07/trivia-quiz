#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start-dev.sh — Start both backend and frontend for local development
#
# Usage:
#   ./start-dev.sh           # start both services
#   ./start-dev.sh backend   # start backend only
#   ./start-dev.sh frontend  # start frontend only
#
# Requirements:
#   - Node.js >= 20.x
#   - npm >= 10.x
#   - backend/.env  (copy from .env.example)
#   - frontend/.env (copy from frontend/.env.example)
#
# The script installs node_modules if they are missing and then starts
# both services in parallel. Output from each service is prefixed with
# [backend] or [frontend] for easy scanning.
#
# To stop: press Ctrl+C — the trap below will kill both background jobs.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── Colors ───────────────────────────────────────────────────────────────────
RESET="\033[0m"
CYAN="\033[0;36m"
YELLOW="\033[0;33m"
GREEN="\033[0;32m"
RED="\033[0;31m"

log()     { echo -e "${CYAN}[start-dev]${RESET} $*"; }
success() { echo -e "${GREEN}[start-dev]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[start-dev]${RESET} $*"; }
error()   { echo -e "${RED}[start-dev]${RESET} $*" >&2; }

# ── Cleanup: kill child processes on Ctrl+C ───────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  warn "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  success "All services stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Prefixed output helper ────────────────────────────────────────────────────
# Usage: run_prefixed "[label]" command args...
run_prefixed() {
  local label="$1"
  shift
  "$@" 2>&1 | while IFS= read -r line; do
    echo -e "${label} ${line}"
  done &
  PIDS+=($!)
}

# ── Dependency check ──────────────────────────────────────────────────────────
check_node() {
  if ! command -v node &>/dev/null; then
    error "Node.js is not installed. Please install Node.js >= 20.x"
    exit 1
  fi
  local node_version
  node_version=$(node -e "process.stdout.write(process.version.replace('v',''))")
  local major
  major=$(echo "$node_version" | cut -d. -f1)
  if [[ "$major" -lt 20 ]]; then
    warn "Node.js $node_version detected. Recommended >= 20.x"
  else
    log "Node.js $node_version OK"
  fi
}

# ── Env file guard ────────────────────────────────────────────────────────────
check_env() {
  local dir="$1"
  local service="$2"
  if [[ ! -f "$dir/.env" ]]; then
    warn "$service/.env not found."
    if [[ -f "$dir/.env.example" ]]; then
      warn "Copying $service/.env.example → $service/.env"
      cp "$dir/.env.example" "$dir/.env"
    elif [[ -f "$SCRIPT_DIR/.env.example" ]]; then
      warn "Copying root .env.example → $service/.env"
      cp "$SCRIPT_DIR/.env.example" "$dir/.env"
    else
      error "No .env.example found for $service. Please create $dir/.env manually."
      exit 1
    fi
  fi
}

# ── Install deps if needed ────────────────────────────────────────────────────
maybe_install() {
  local dir="$1"
  local service="$2"
  if [[ ! -d "$dir/node_modules" ]]; then
    log "Installing $service dependencies..."
    (cd "$dir" && npm install)
    success "$service dependencies installed."
  fi
}

# ── Start backend ─────────────────────────────────────────────────────────────
start_backend() {
  log "Starting backend on http://localhost:3001 ..."
  check_env "$BACKEND_DIR" "backend"
  maybe_install "$BACKEND_DIR" "backend"
  run_prefixed "\033[0;36m[backend]\033[0m" \
    bash -c "cd \"$BACKEND_DIR\" && npm run dev"
  success "Backend started (pid ${PIDS[-1]})"
}

# ── Start frontend ────────────────────────────────────────────────────────────
start_frontend() {
  log "Starting frontend on http://localhost:5173 ..."
  check_env "$FRONTEND_DIR" "frontend"
  maybe_install "$FRONTEND_DIR" "frontend"
  run_prefixed "\033[0;33m[frontend]\033[0m" \
    bash -c "cd \"$FRONTEND_DIR\" && npm run dev"
  success "Frontend started (pid ${PIDS[-1]})"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  local target="${1:-both}"

  check_node

  echo ""
  log "============================================"
  log "  Trivia Quiz — Local Dev"
  log "  Backend  : http://localhost:3001"
  log "  Frontend : http://localhost:5173"
  log "  Stop     : Ctrl+C"
  log "============================================"
  echo ""

  case "$target" in
    backend)
      start_backend
      ;;
    frontend)
      start_frontend
      ;;
    both|"")
      start_backend
      # Brief pause so backend starts before frontend attempts connection
      sleep 1
      start_frontend
      ;;
    *)
      error "Unknown target: $target. Use: both | backend | frontend"
      exit 1
      ;;
  esac

  # Wait for all background jobs; cleanup() handles Ctrl+C
  wait
}

main "${1:-both}"
