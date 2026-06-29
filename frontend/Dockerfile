# MediFlow frontend (Vue 3 + Vite) served as static assets by nginx.
# Multi-stage: build with Node, serve with an unprivileged nginx image.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Bake the API base URL at build time. Defaults to "/api" (same-origin via the
# nginx /api proxy), so the deployed SPA needs no CORS. Override with --build-arg.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Runtime: nginx-unprivileged listens on 8080 and runs as a non-root user by default.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
