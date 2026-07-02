#!/usr/bin/env bash
# Post-deploy smoke test for the MediFlow production stack.
#
# Runs ON the production VM in the repo directory immediately after
# `docker compose ... up -d --build` (see .github/workflows/deploy.yml). It fails fast
# and non-zero on the first broken check so a bad deploy trips the SSH step (and the whole
# Deploy workflow) instead of silently shipping a half-up stack.
#
# Checks, in order:
#   1. Required containers (db, backend, frontend, caddy) are running AND healthy.
#      clamav is OPTIONAL — a warning, never a failure (the backend fails uploads closed
#      until its ~1 GB signature DB finishes loading, which is fine at deploy time).
#   2. Caddy is answering on the published host ports 80 and 443.
#   3. The frontend nginx is serving on its container port 8080 (not host-published, so
#      it is probed from inside the frontend container).
#   4. The API health endpoint returns 200 through the real Caddy -> nginx -> backend path.
#
# Usage on the VM:
#   bash ops/container/smoke-test.sh
#
# Configurable via env (all have sane defaults):
#   COMPOSE_FILE  compose file            (default docker-compose.prod.yml)
#   ENV_FILE      compose --env-file      (default .env.production)
#   HEALTH_URL    API health check URL    (default https://localhost/api/health)
set -euo pipefail

# --- config (env with sensible defaults) ---
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
# Caddy terminates TLS only for its configured DOMAIN (SNI-bound), so probing
# https://localhost fails the handshake. Resolve DOMAIN from the environment or the compose
# env file and probe THAT hostname pinned to loopback (--resolve) below.
DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -f "$ENV_FILE" ]; then
  DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d '"'"'\r'"'"')"
fi
DOMAIN="${DOMAIN:-localhost}"
HEALTH_URL="${HEALTH_URL:-https://${DOMAIN}/api/health}"

# Services that MUST be up + healthy for the deploy to count as good.
REQUIRED_SERVICES=(db backend frontend caddy)
# Services that are nice-to-have; missing/unhealthy only warns.
OPTIONAL_SERVICES=(clamav)

command -v docker >/dev/null || { echo "FAIL: docker is required"; exit 1; }
command -v curl   >/dev/null || { echo "FAIL: curl is required"; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

fail() {
  echo "SMOKE TEST FAILED: $*" >&2
  exit 1
}

# Resolve the container id backing a compose service (empty string if the service has no
# container at all — e.g. it was never started or was scaled to zero).
container_id() {
  compose ps -q "$1" 2>/dev/null | head -n 1
}

# Report a container's health: prints "healthy", "unhealthy", "starting", "none" (no
# healthcheck defined but running), or "missing" (no container / not running).
container_state() {
  local service="$1" cid status health
  cid="$(container_id "$service")"
  [ -n "$cid" ] || { echo "missing"; return; }
  # Running state first: a stopped/restarting container is never "healthy".
  status="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)"
  [ "$status" = "running" ] || { echo "missing"; return; }
  # .State.Health is absent when the image declares no HEALTHCHECK; treat running-with-no-
  # healthcheck as "none" (acceptable) rather than a failure.
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)"
  echo "$health"
}

echo "== MediFlow post-deploy smoke test =="
echo "compose file: ${COMPOSE_FILE}  env file: ${ENV_FILE}"
echo

# 1. Required containers running + healthy. Freshly recreated containers spend their
# healthcheck start-period in "starting" right after `up -d` (the backend's first check only
# fires ~30s in), so POLL until they converge instead of sampling once. Fail fast on a real
# "unhealthy"; treat "starting"/"missing" as transient until the timeout.
WAIT_TIMEOUT="${WAIT_TIMEOUT:-150}"
echo "[1/4] Waiting up to ${WAIT_TIMEOUT}s for required containers to be running and healthy..."
deadline=$(( $(date +%s) + WAIT_TIMEOUT ))
while :; do
  pending=""
  for service in "${REQUIRED_SERVICES[@]}"; do
    state="$(container_state "$service")"
    case "$state" in
      healthy|none) ;;                                   # good
      starting|missing) pending="${pending} ${service}(${state})" ;;   # transient — keep waiting
      *) fail "required service '${service}' is not healthy (state: ${state})" ;;  # unhealthy/unknown
    esac
  done
  [ -z "$pending" ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    fail "timed out after ${WAIT_TIMEOUT}s waiting for:${pending}"
  fi
  sleep 3
done
for service in "${REQUIRED_SERVICES[@]}"; do
  echo "  ok: ${service} ($(container_state "$service"))"
done

# 1b. Optional containers — warn only, never fail.
for service in "${OPTIONAL_SERVICES[@]}"; do
  state="$(container_state "$service")"
  case "$state" in
    healthy|none) echo "  ok: ${service} (${state}, optional)" ;;
    *)            echo "  WARN: optional service '${service}' is ${state} (uploads fail closed until it is ready)" ;;
  esac
done

# 2. Caddy answering on the published host ports 80 and 443. We hit the real DOMAIN (so
# Caddy's SNI/vhost + cert match) but pin it to loopback with --resolve, so this works on the
# VM without relying on public DNS/NAT hairpinning.
echo "[2/4] Checking Caddy on host ports 80 and 443 (host: ${DOMAIN})..."
# Port 80 typically 308-redirects to HTTPS; -f treats 3xx as success, and we only care that
# Caddy answers.
curl -fsS -o /dev/null --resolve "${DOMAIN}:80:127.0.0.1" "http://${DOMAIN}/" \
  || fail "Caddy did not respond on port 80 for ${DOMAIN}"
echo "  ok: Caddy responded on port 80"
# -k: skip trust verification (staging/internal certs are fine here — we assert reachability +
# a successful TLS handshake for the domain, not the cert chain).
curl -fsSk -o /dev/null --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/" \
  || fail "Caddy did not complete TLS on port 443 for ${DOMAIN}"
echo "  ok: Caddy responded on port 443"

# 3. Frontend nginx serving on 8080. It is only exposed on the compose network (not
# host-published), so probe it from inside the frontend container. The nginx-unprivileged
# alpine image ships wget but not curl, so prefer wget and fall back to curl if present.
echo "[3/4] Checking frontend nginx is serving on container port 8080..."
if compose exec -T frontend sh -c \
     'if command -v wget >/dev/null 2>&1; then wget -q -O /dev/null http://localhost:8080/; \
      elif command -v curl >/dev/null 2>&1; then curl -fsS -o /dev/null http://localhost:8080/; \
      else echo "no wget/curl in frontend container" >&2; exit 127; fi'; then
  echo "  ok: nginx served http://localhost:8080/ inside the frontend container"
else
  fail "frontend nginx did not serve on container port 8080"
fi

# 4. API health endpoint through the full Caddy -> nginx -> backend path.
# Backend defines GET /api/health -> 200 {"status":"ok"} (backend/server.js).
echo "[4/4] Checking API health at ${HEALTH_URL}..."
health_body="$(curl -fsSk --resolve "${DOMAIN}:443:127.0.0.1" "$HEALTH_URL")" \
  || fail "health check did not return HTTP 200 from ${HEALTH_URL}"
case "$health_body" in
  *'"status":"ok"'*|*'"status": "ok"'*)
    echo "  ok: health endpoint returned {\"status\":\"ok\"}"
    ;;
  *)
    fail "health endpoint returned 200 but unexpected body: ${health_body}"
    ;;
esac

echo
echo "SMOKE TEST PASSED"
