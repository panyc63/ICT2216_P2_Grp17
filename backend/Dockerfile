# MediFlow backend (Express API).
# Hardened image: pinned base, production-only deps, runs as non-root.
FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies against the committed lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source.
COPY . .

# Drop root privileges (the official node image ships an unprivileged "node" user).
USER node

EXPOSE 5000

# Liveness probe used by docker-compose / orchestrators (Node 22 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
