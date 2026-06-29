#!/usr/bin/env bash
# Fetch MediFlow secrets from AWS Secrets Manager and write .env.production.
#
# Run on the EC2 instance (which has an IAM role granting secretsmanager:GetSecretValue
# + kms:Decrypt) BEFORE `docker compose -f docker-compose.prod.yml ... up`. Secrets Manager
# transparently decrypts the value with the KMS CMK, so the plaintext never lives in git.
#
#   SECRET_ID=mediflow/prod AWS_REGION=ap-southeast-1 ./deploy/load-secrets.sh
#
# The secret must be a JSON object whose keys are the env var names the backend expects
# (JWT_SECRET, CSRF_SECRET, DATA_ENCRYPTION_KEY, MC_SIGNING_KEY, DB_PASSWORD, DOMAIN,
# ACME_EMAIL, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, ...).
set -euo pipefail

SECRET_ID="${SECRET_ID:?set SECRET_ID (e.g. mediflow/prod)}"
AWS_REGION="${AWS_REGION:?set AWS_REGION (e.g. ap-southeast-1)}"
OUT="${OUT:-.env.production}"

command -v aws >/dev/null || { echo "aws CLI is required"; exit 1; }
command -v jq  >/dev/null || { echo "jq is required";       exit 1; }

echo "Fetching ${SECRET_ID} from Secrets Manager (${AWS_REGION})..."
SECRET_JSON="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" --region "$AWS_REGION" \
  --query SecretString --output text)"

# Convert {"KEY":"value",...} -> KEY=value lines, written with 600 perms.
umask 177
jq -r 'to_entries[] | "\(.key)=\(.value)"' <<<"$SECRET_JSON" > "$OUT"
echo "Wrote $(grep -c '=' "$OUT") secrets to ${OUT} (mode 600)."
