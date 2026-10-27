# FDS OWASP Checklist - Source Notes

DDP-183, updated 27 October 2026. Evidence applies to the tested Front Desk feature branch and isolated local validations only. No overall OWASP compliance certification is made.

| Category | Status | Evidence | Remaining work |
|---|---|---|---|
| A01 Broken Access Control | PARTIALLY EVIDENCED | JWT authorization, read/write RBAC, 401/403 E2E checks, invalid actor and real WKMS assignment permission tests. | Complete endpoint-by-role matrix, negative authorization checks on every protected route, public staging review. |
| A02 Cryptographic Failures | NOT FULLY VERIFIED | JWT signature and issuer unit tests; local test-only JWTs used for evidence. | Central identity password storage (bcrypt >=12), refresh-token controls, staging HTTPS/TLS and deployed secret handling. |
| A03 Injection | PARTIALLY EVIDENCED | PostgreSQL parameter binding, DTO validation, text sanitization tests. | Targeted route-level injection and fuzzing review. |
| A04 Insecure Design | NOT FULLY VERIFIED | Database transaction rollback and append-only audit tests. | Approved threat model, sign-off of cross-service trust/security design. |
| A05 Security Misconfiguration | PARTIALLY EVIDENCED | Joi production/staging configuration validation, DB_SYNC guard, origins checks, CI/Docker checks. | Actual public staging configuration and error-disclosure testing. |
| A06 Vulnerable and Outdated Components | REMEDIATED IN TESTED FEATURE BRANCH | undici dev dependency upgraded to 8.12.2 in commit 1065617. Frontend CI full audit = 0 vulnerabilities; production-only = 0; backend CI audit = 0. | Merge fix into default branch and recheck Dependabot alert #24 and independent supply-chain risks. |
| A07 Identification and Authentication Failures | PARTIALLY EVIDENCED | Bad/expired/wrong-issuer JWT rejection tested; Socket.IO authentication checks. | Central Auth login, session rotation, account lockout, rate limits with live identity provider. |
| A08 Software and Data Integrity Failures | PARTIALLY EVIDENCED | npm ci, lockfiles, append-only audit trigger with PostgreSQL tests; protected GitHub CI. | Signed release artifacts, provenance and production deployment integrity review. |
| A09 Security Logging and Monitoring Failures | PARTIALLY EVIDENCED | Audit records for check-in, room updates, assignments; redacting logger and append-only DB. | Staging alerting/monitoring, logs for authentication failures and actual retention. |
| A10 Server-Side Request Forgery | NOT FULLY VERIFIED | WKMS outbound HTTP integration uses configured service URL, with local secured assignment integration verification. | Outbound URL allowlist and SSRF negative tests in deployed environment. |

## Dependency audit correction

Old HIGH finding in the `undici` development dependency has been remediated on the feature branch by commit `1065617` (version 8.12.2). Full frontend and production-only npm audits returned **zero vulnerabilities** in https://github.com/forever-hotel/front-desk/actions/runs/40534533200. Backend audit passed at https://github.com/forever-hotel/front-desk/actions/runs/40530366600. GitHub default-branch Dependabot #24 should be checked after merging; it was still reported at feature-branch push.

## Cross-service limitations

Real local WKMS checkout consumption/outbox, FDS/WKMS reconnection and manual assignment were demonstrated in bounded disposable environments. Central Auth, public staging, FOSS activation, real payment and printing remain separate acceptance dependencies. Worker discovery/task creation WKMS endpoints remain blocked.
