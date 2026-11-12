# Stage 1: build the Next.js frontend into static files (frontend/out).
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The templates are read at build time from ../templates.
COPY templates/ /app/templates/
RUN npm run build

# Stage 2: FastAPI backend, which also serves the static frontend.
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never \
    UV_COMPILE_BYTECODE=1 \
    PATH="/app/backend/.venv/bin:$PATH" \
    STATIC_DIR=/app/static \
    DB_PATH=/app/data/prelegal.db
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/src/ ./src/
RUN uv sync --locked --no-dev
COPY --from=frontend /app/frontend/out /app/static

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
