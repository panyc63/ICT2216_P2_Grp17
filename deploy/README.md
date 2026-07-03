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

---

## Phase 0 — Production security hardening (AWS)

### Secrets in AWS KMS + Secrets Manager (instead of a plaintext .env)
1. Create a KMS customer-managed key (CMK) for MediFlow.
2. Create a Secrets Manager secret `mediflow/prod` (encrypted with that CMK) whose value is a
   JSON object of the backend env vars:
   ```json
   { "JWT_SECRET": "...", "CSRF_SECRET": "...", "DATA_ENCRYPTION_KEY": "...",
     "MC_SIGNING_KEY": "...", "DB_PASSWORD": "...", "DOMAIN": "mediflow.example.com",
     "ACME_EMAIL": "you@example.com", "STRIPE_WEBHOOK_SECRET": "...", "RESEND_API_KEY": "..." }
   ```
   Generate each key with `openssl rand -base64 48`.
3. Attach `deploy/aws-iam-policy.json` (edit the ARNs) to the **EC2 instance role** —
   least-privilege `secretsmanager:GetSecretValue` on the secret + `kms:Decrypt` on the CMK.
4. On the instance, materialise `.env.production` from the secret at boot:
   ```bash
   SECRET_ID=mediflow/prod AWS_REGION=ap-southeast-1 ./deploy/load-secrets.sh
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
   Secrets Manager decrypts via KMS automatically using the instance role — no key material
   is ever committed. (The backend still reads the same env vars, so no app change is needed.)

### Encryption at rest — EBS (instead of RDS)
Enable **EBS encryption** on the instance's data volume (default-encrypt new volumes in the
EC2 console, or `--encrypted` at launch). This encrypts the MySQL `db_data` volume at rest —
the pragmatic equivalent of RDS encryption for the single-VM tier.

### Edge WAF / DDoS — Cloudflare (instead of AWS WAF)
AWS WAF needs an ALB/CloudFront. For the single EC2, put **Cloudflare** in front:
1. Add the domain to Cloudflare; set the A-record (proxied/orange-cloud) to the EC2 IP.
2. Set SSL/TLS mode **Full (strict)** (Caddy already serves a valid cert).
3. Enable the **WAF managed ruleset**, **rate limiting** (e.g. on `/api/login`), and Bot Fight Mode.
4. Lock the EC2 security group to only accept 80/443 from Cloudflare IP ranges, so the origin
   can't be reached directly.

This gives managed WAF + DDoS + rate limiting + origin hiding without an ALB.
