# Deploying MediFlow to a single VM (docker-compose + auto-HTTPS)

This hosts the whole stack on one Linux VM behind **Caddy** (automatic Let's Encrypt
HTTPS). Frontend + backend share **one origin** (`https://<domain>`), so the secure
session cookie and CSRF work with no CORS configuration. This gives you the **live
public URL** needed for the browser demo and for **Report III DAST**.

```
Internet ──443──> Caddy ──> frontend (nginx: SPA + /api proxy) ──> backend ──> MySQL
                  (public)        (internal)                       (internal)  (internal)
```

## Prerequisites
- A Linux VM with a public IP (e.g. AWS EC2 `t3.small`, or any VPS). This is the
  pragmatic "EC2 tier" of the architecture in Deliverable 1.
- A domain name with a **DNS A-record pointing at the VM's public IP**.
- Inbound ports **80** and **443** open in the firewall / security group.

## One-time VM setup
```bash
# 1. Install Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER" && newgrp docker

# 2. Get the code
git clone https://github.com/panyc63/ICT2216_P2_Grp17.git
cd ICT2216_P2_Grp17

# 3. Configure environment
cp .env.production.example .env.production
#   Edit .env.production: set DOMAIN, ACME_EMAIL, DB_PASSWORD, and generate the 4 secrets:
#     for k in JWT_SECRET CSRF_SECRET DATA_ENCRYPTION_KEY MC_SIGNING_KEY; do
#       echo "$k=$(openssl rand -base64 48)"; done
```

## Launch
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
Caddy obtains a TLS certificate automatically on first request to your domain.

## Verify
```bash
curl -s https://<domain>/api/health        # -> {"status":"ok"}
```
Open `https://<domain>/` in a browser. Seed logins (from `setup.sql`) use password
**`Password123!`** — e.g. `admin@mediflow.com`, `doctor@mediflow.com`, `john@gmail.com`.

## Operations
```bash
docker compose -f docker-compose.prod.yml logs -f          # tail logs
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build   # redeploy after git pull
docker compose -f docker-compose.prod.yml down             # stop (keeps DB volume)
docker compose -f docker-compose.prod.yml down -v          # stop + wipe DB
```
The MySQL data persists in the `db_data` volume; `setup.sql` only seeds on first init.

## Report III — DAST against the hosted app
Point OWASP ZAP at the live URL, e.g.:
```bash
docker run --rm -v "$(pwd):/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://<domain> -r zap-report.html
```
(The repo's `.github/workflows/zap-dast.yml` runs the same baseline scan in CI against
the docker-compose stack.)

## Notes
- Only Caddy is internet-facing; `backend` and `db` are not published to the host.
- For staff MFA, set `RESEND_API_KEY` in `.env.production`; otherwise set
  `MFA_REQUIRED_ROLES=disabled` for a no-email demo (see the env file comments).
- Optional continuous deploy: `.github/workflows/deploy.yml` can SSH in and redeploy on
  push to `main` once you add the `DEPLOY_SSH_*` repository secrets.
