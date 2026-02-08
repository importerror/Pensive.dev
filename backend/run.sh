#!/bin/sh
# Use PORT from environment (Railway sets this); default 8001 for local
PORT=${PORT:-8001}
exec uvicorn server:app --host 0.0.0.0 --port "$PORT"
