// Cloudflare Turnstile server-side verification.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// The frontend renders a Turnstile widget and submits the resulting token as
// `cf-turnstile-response`. Before any database work on an unauthenticated entry path
// (login, registration, triage) we validate that token here against Cloudflare's
// siteverify API, so bots can't drive those flows.
//
// Graceful bypass: when TURNSTILE_SECRET is unset (local dev / CI / tests) verification is
// skipped and returns success, mirroring the other optional integrations (Firebase, TURN).

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token with Cloudflare.
 * @param {string} token   the `cf-turnstile-response` value from the client
 * @param {string} secret  the Turnstile secret key (empty => bypass)
 * @param {string} [remoteIp] the real client IP (optional, improves scoring)
 * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string }>}
 */
export async function verifyTurnstile(token, secret, remoteIp) {
  // Not configured -> do not block (dev/test/CI).
  if (!secret) return { success: true, skipped: true };
  // Configured but no token supplied -> reject without an outbound call.
  if (!token || typeof token !== 'string') return { success: false, error: 'missing-input-response' };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  let response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Never hang a request path on the verification call.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Network failure / timeout: fail closed (the token could not be proven valid).
    return { success: false, error: 'verification-unreachable' };
  }

  const data = await response.json().catch(() => ({}));
  return {
    success: data.success === true,
    error: Array.isArray(data['error-codes']) ? data['error-codes'].join(',') : undefined,
  };
}
