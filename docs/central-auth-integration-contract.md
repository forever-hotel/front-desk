# Front Desk -> Central Authentication Service (proposed contract)

Status: **PROPOSED, not yet approved by Central Auth team**.

## Ownership

Central Auth owns credential verification, staff login, session lifecycle,
identity data and token signing. Front Desk owns validating accepted identity
assertions and enforcing RECEPTIONIST/MANAGER permissions. The shared API
Gateway routes FDS REST requests; it does not issue or verify JWTs.

## Proposed access-token profile

- Signed JWT with `alg=RS256`, verified using the Central Auth team's trusted
  HTTPS JWKS endpoint (not a URL supplied by the token).
- `iss`: exact agreed Central Auth issuer.
- `aud`: must contain `fds`.
- `sub`: stable UUID v4 staff identity.
- `iat`, `exp`: required, with a short lifetime and limited clock skew.
- `role`: `RECEPTIONIST` or `MANAGER` (role claim format pending agreement).
- Reject invalid/expired tokens and tokens issued for other subsystems.

## Contract to agree with Central Auth team

1. Issuer URL, HTTPS JWKS URL, key rotation and outage behavior.
2. Token format, signature algorithms, audience and claim names.
3. Login/redirect flow, refresh, sign-out and session revocation.
4. Cross-origin cookie policy, CSRF strategy, and browser/BFF ownership.
5. Staff identity mapping and role assignment semantics.
6. Authenticated Socket.IO handshake and token refresh policy.

## Current status

`central-auth-jwt.verifier.ts` is an isolated, unit-tested verifier for the
proposed token profile. It is **not wired into production authentication yet**.
Existing FDS HS256 JWT handling remains unchanged until the above contract is
approved and integration is implemented. Tests use local keys and do not need a
running Central Authentication Service.
