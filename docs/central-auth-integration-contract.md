# Staff authentication contract

The shared API Gateway is the staff authentication authority. FDS never signs
staff JWTs or checks staff password hashes. Configure server-only
`AUTH_SERVICE_URL` to the gateway origin (Compose: `http://api-gateway:8080`).

FDS REST and native socket authentication call `GET /fds/auth/session` with the
bearer token. The gateway validates signature/issuer/audience/expiry, current
roles, account activation, session version and logout revocation. Protected
features additionally reject `passwordChangeRequired=true`. There is no fallback
to local HS256 or a proposed RS256/JWKS provider when the gateway is unavailable.

Accounts have one email and multiple roles. Receptionist opens FDS; ROOT passes
all FDS owner role guards. The gateway chooses the effective FDS role from the
account roles array. Owner guards still authorize individual operations.

Apply the root documents/forever-hotel-unified.sql staff roles upgrade manually
before rebuilding. See root documents/STAFF_AUTH_SETUP.md for bootstrap ROOT,
shared credentials, first password change and configuration.
