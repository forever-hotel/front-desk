# Front Desk automatic staging

A final-head peer-approved merge to develop runs backend, frontend, container and release-controller checks. Publication uploads immutable release-images. The staging job downloads the manifest from that same run and deploys only fds-backend and fds-frontend. Routine Front Desk releases do not need a second infra PR.

## Setup

Configure repository variables FDS_STAGING_ENABLED=true, STAGING_HOST=forever-hotel-staging.malaysiawest.cloudapp.azure.com and STAGING_USER=azureuser. The develop-only staging environment needs encrypted STAGING_SSH_KEY and STAGING_KNOWN_HOSTS secrets. These are not inherited from infra.

The VM must contain the approved /opt/forever-hotel/.infra-release/host.json, running Front Desk containers, registry pull access and noninteractive sudo docker. The approved service change must be compatible with the installed database. No database migration runs automatically.

## Checks and recovery

The job rejects stale develop runs, validates exact Front Desk digests and source commit, checks adopted configuration hashes and baseline health, then pulls images. It holds the same full-system and sample locks as infra. A busy lock fails safely: rerun the latest eligible workflow after the other release finishes. Only the two Front Desk containers are recreated. Other active image selections are preserved.

Readiness, shared WebSocket and public HTTPS checks run before and after replacement. A failed rollout attempts previous-image recovery and remains a failed run. Failed recovery is recorded as failed_rollback_unverified. The private fds-last-attempt.json records source commit, images, baseline and outcome. A successful job retains frontdesk-staging-receipt. Health checks do not prove business correctness: test the changed receptionist flow.

## Full infra releases

Routine Front Desk deployment does not commit to infra. Before a later full infra release, synchronize its FDS digests with the latest successful Front Desk receipt. An old full manifest can select older FDS images. Coordinate schema, env, route and Compose changes separately. Reviewed public configuration changes require host re-adoption. Do not delete an active lock. Production is unchanged.

## Local checks

Run node --test deploy/staging/release.test.mjs and bash -n deploy/staging/remote-release.sh, plus the repository's usual quality gates. The workflow checks the deployment controller on PRs before publishing images.
