# syntax=docker/dockerfile:1

# ── Etapa 1: compilar el frontend ──
FROM node:24-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Etapa 2: dependencias de produccion del backend (compila better-sqlite3 si hace falta) ──
FROM node:24-slim AS backend-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ── Etapa 3: imagen final, liviana, sin herramientas de compilacion ──
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/ ./
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/dist ../frontend/dist

# El usuario "node" ya viene incluido en la imagen oficial; evita correr como root
RUN mkdir -p data && chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/api/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
