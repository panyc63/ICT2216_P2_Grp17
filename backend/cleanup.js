// Active database state housekeeping.
//
// Periodically purges expired/dead security and workflow rows so sensitive data (OTPs,
// reset tokens, abandoned sign-ups, stale WebRTC signalling) does not accumulate. Reuses
// the app's mysql2 pool. Every statement is guarded on a NOT NULL expiry/age so seed rows
// with NULL timestamps are never touched, and all deletes are scoped to genuinely dead
// state (never completed clinical records).

export const CLEANUP_TASKS = [
  // Abandoned MFA challenges: clear the one-time secret once its 5-minute window lapses.
  { label: 'expired_mfa_challenges',
    sql: "UPDATE users SET mfa_challenge_id = NULL, mfa_otp_hash = NULL, mfa_expires_at = NULL WHERE mfa_expires_at IS NOT NULL AND mfa_expires_at < NOW()" },
  // Expired password-reset tokens: single-use + time-limited; drop once past expiry.
  { label: 'expired_reset_tokens',
    sql: "UPDATE users SET reset_token_hash = NULL, reset_expires_at = NULL WHERE reset_expires_at IS NOT NULL AND reset_expires_at < NOW()" },
  // Lapsed account lockouts: clear the lock + failed-attempt counter once the window ends.
  { label: 'expired_lockouts',
    sql: "UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE locked_until IS NOT NULL AND locked_until < NOW()" },
  // Never-verified sign-ups: remove PendingVerification accounts whose verification link expired.
  { label: 'unverified_accounts',
    sql: "DELETE FROM users WHERE status = 'PendingVerification' AND email_verification_expires_at IS NOT NULL AND email_verification_expires_at < NOW()" },
  // Stale triage that never reached a doctor (still Waiting/Called) after a week.
  { label: 'stale_triage',
    sql: "DELETE FROM triage_submissions WHERE status IN ('Waiting', 'Called') AND created_at < (NOW() - INTERVAL 7 DAY)" },
  // WebRTC signalling is only needed during an active call; purge anything older than a day.
  { label: 'old_signaling',
    sql: "DELETE FROM signaling_messages WHERE created_at < (NOW() - INTERVAL 1 DAY)" },
  // Orphaned recording sessions that started but never ended (hung calls) after 6 hours.
  { label: 'orphaned_recordings',
    sql: "DELETE FROM recording_sessions WHERE ended_at IS NULL AND started_at < (NOW() - INTERVAL 6 HOUR)" },
  // Abandoned WebAuthn ceremony challenges (single-use, 5-minute window).
  { label: 'expired_webauthn_challenges',
    sql: "DELETE FROM webauthn_challenges WHERE expires_at < NOW()" },
];

// Runs every task once; returns a { label: affectedRows | 'error: ...' } summary.
// Never throws — a single failing task must not abort the rest or crash the process.
export async function runCleanup(pool) {
  const summary = {};
  for (const task of CLEANUP_TASKS) {
    try {
      const [res] = await pool.execute(task.sql);
      summary[task.label] = res.affectedRows || 0;
    } catch (err) {
      summary[task.label] = `error: ${err.code || err.message}`;
    }
  }
  return summary;
}

// Schedules runCleanup shortly after boot and then on an interval. The timers are
// unref()'d so they never keep the Node process alive, and onRun receives the summary
// (used to write an audit row). Not started under NODE_ENV=test.
export function scheduleCleanup(pool, { intervalMs = 6 * 60 * 60 * 1000, startupDelayMs = 5000, onRun } = {}) {
  const tick = async () => {
    const summary = await runCleanup(pool);
    try { if (onRun) await onRun(summary); } catch { /* never let logging crash the job */ }
  };
  const startupTimer = setTimeout(tick, startupDelayMs);
  const intervalTimer = setInterval(tick, intervalMs);
  startupTimer.unref?.();
  intervalTimer.unref?.();
  return { startupTimer, intervalTimer };
}
