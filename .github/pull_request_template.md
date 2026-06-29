# Summary

<!-- What does this PR change and why? Link any issue/requirement. -->

## Type of change
- [ ] Feature
- [ ] Bug fix
- [ ] Security hardening
- [ ] CI/CD / tooling
- [ ] Documentation

## Security checklist (Deliverable 1 + OWASP ASVS / Top 10)
- [ ] All new request input is **validated** server-side before use (no trust of client role/ID/status).
- [ ] Database access uses **parameterised queries** only (no string-concatenated SQL).
- [ ] New routes enforce **authentication + RBAC** (`authenticate`, `requireRole`, object-level checks).
- [ ] High-risk actions require **re-auth / MFA** where applicable.
- [ ] No **secrets** committed (`.env` values only); no **PHI / passwords / OTPs / tokens** logged.
- [ ] Sensitive at-rest data is **encrypted**; security-relevant events are **audited**.
- [ ] Added/updated **automated tests** for the change.

## Testing
<!-- How was this verified? e.g. `npm test`, integration tests, `npm run build`, manual steps. -->

## CI / scanners
- [ ] CI (lint, unit, build, audit) is green.
- [ ] CodeQL / Semgrep / dependency / secret / container scans reviewed (no new high/critical findings, or risk documented below).

<!-- Document any accepted residual risk here. -->
