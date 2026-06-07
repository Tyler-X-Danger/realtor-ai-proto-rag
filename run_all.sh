#!/bin/bash
# AmpAI Hub — local dev launcher
# Starts FastAPI RAG backend (port 8000) and Vite frontend (port 5173) concurrently.

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill child processes when this script exits (Ctrl+C)
trap 'echo ""; echo "Shutting down..."; kill $(jobs -p) 2>/dev/null; exit 0' SIGINT SIGTERM EXIT

echo "======================================"
echo "  AmpAI Hub — Local Dev Environment"
echo "======================================"
echo ""

# --- FastAPI RAG backend ---
echo "[1/2] Starting FastAPI backend on http://localhost:8000 ..."
cd "$ROOT" && python3 server.py &
BACKEND_PID=$!

# Give the backend a moment to start and build the index
sleep 2

# --- Vite frontend ---
echo "[2/2] Starting Vite frontend on http://localhost:5173 ..."
cd "$ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "--------------------------------------"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  Health:   http://localhost:8000/health"
echo "--------------------------------------"
echo "  Press Ctrl+C to stop both servers."
echo "--------------------------------------"
echo ""

# Wait for both background jobs
wait
