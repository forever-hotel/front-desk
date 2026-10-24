# FDS OWASP Checklist - Editable Notes

## A01 Broken Access Control
Status: **PARTIALLY EVIDENCED**
Evidence: JWT, RBAC read/write roles and 401/403 E2E tests available. Not an audited guarantee for every endpoint.
Test/source: backend/test/bookings-rbac.e2e-spec.ts; backend/test/check-in-rbac.e2e-spec.ts; backend/test/rooms-rbac.e2e-spec.ts
Next action: Produce endpoint/role access matrix; negative tests for every protected endpoint.

## A02 Cryptographic Failures
Status: **NOT FULLY VERIFIED**
Evidence: JWT signature and issuer tests exist; password hashing with bcrypt cost >=12 and production TLS/hashed refresh tokens are central-auth/deployment responsibilities, not established by FDS CI.
Test/source: backend/src/security/auth/jwt-principal.resolver.spec.ts; backend/src/config/env.validation.spec.ts
Next action: Obtain central auth evidence for bcrypt >=12, token handling and actual staging HTTPS/TLS.

## A03 Injection
Status: **PARTIALLY EVIDENCED**
Evidence: PostgreSQL repository uses parameter placeholders; DTO and text sanitation tests present. Exhaustive injection fuzzing not shown.
Test/source: backend/src/reservations/repositories/postgres-booking.repository.ts; backend/src/security/sanitization/sanitize-plain-text.spec.ts
Next action: Perform targeted SQL/NoSQL injection and input validation tests per route.

## A04 Insecure Design
Status: **NOT VERIFIED**
Evidence: Transaction/audit protections have code and tests; signed threat model/design security review not verified from CI.
Test/source: backend/test/database/postgres-checkout.repository.integration-spec.ts; backend/test/database/audit-append-only.integration-spec.ts
Next action: Link reviewed SDS threat model and architecture/security review decisions.

## A05 Security Misconfiguration
Status: **PARTIALLY EVIDENCED**
Evidence: Staging/production env validation checks JWT secrets, wildcard origins and DB_SYNCHRONIZE; deployed error handling / default credentials not verified.
Test/source: backend/src/config/env.validation.spec.ts; backend/src/config/env.validation.ts
Next action: Run hardened staging configuration test and production error disclosure review.

## A06 Vulnerable Components
Status: **OPEN FINDING**
Evidence: Backend high-level dependency audit passed (0 findings). Frontend production-only audit passed (0). Nonblocking full frontend audit found 1 HIGH in dev-dependency undici 8.0.0-8.12.1.
Test/source: Backend CI 40057114169; Frontend CI 40057114175
Next action: Remediate/update undici as feasible, rerun full audit, document accepted residual risk before sign-off.

## A07 Authentication Failures
Status: **PARTIALLY EVIDENCED**
Evidence: JWT invalid/expired/issuer/signature denial tested; centralized login rate limiting/account lockout not evidenced in FDS.
Test/source: backend/src/security/auth/jwt-principal.resolver.spec.ts; backend/test/realtime.e2e-spec.ts
Next action: Obtain central authentication service lockout/session rotation tests.

## A08 Software and Data Integrity Failures
Status: **PARTIALLY EVIDENCED**
Evidence: package-lock.json present; npm ci used in CI; append-only audit DB trigger tested. Full artifact signing / supply chain provenance not verified.
Test/source: backend/package-lock.json; frontend/package-lock.json; .github/workflows/backend-ci.yml
Next action: Review dependency provenance/build integrity and migration/change control.

## A09 Security Logging and Monitoring Failures
Status: **PARTIALLY EVIDENCED**
Evidence: Audit logging and PII/secret redaction tests exist; comprehensive auth-failure/data access logging and monitoring not proven.
Test/source: backend/src/security/redaction/log-redactor.spec.ts; backend/test/database/audit-append-only.integration-spec.ts
Next action: Verify staged auth/authorization failure logging with redacted records and alerting.

## A10 Server-Side Request Forgery
Status: **NOT VERIFIED**
Evidence: WKMS HTTP integration client exists; no dedicated SSRF/URL allow-list test was located in reviewed evidence.
Test/source: backend/src/integrations/wkms/wkms-http.client.spec.ts
Next action: Verify fixed trusted service endpoint and outbound allowlist; test rejected untrusted URLs.


Current open finding: frontend full dev audit reports 1 high vulnerability in `undici` (Oct 24 2026); frontend prod-only audit is zero. Recheck after remediation.
