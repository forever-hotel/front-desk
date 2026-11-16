#!/usr/bin/env bash
set -euo pipefail
: "${STAGING_HOST:?Set staging host}"
: "${STAGING_USER:?Set staging user}"
: "${SSH_PRIVATE_KEY:?Set encrypted staging key}"
: "${SSH_KNOWN_HOSTS:?Set verified host entry}"
[[ "$STAGING_HOST" = forever-hotel-staging.malaysiawest.cloudapp.azure.com ]]
[[ "$STAGING_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
node --input-type=module -e 'import {readFileSync} from "node:fs";import {validateRelease} from "./deploy/staging/release.mjs";validateRelease(JSON.parse(readFileSync(".staging-release/release-images.json","utf8")),process.env.GITHUB_SHA);'
ssh_dir="$RUNNER_TEMP/fds-ssh"
install -d -m 700 "$ssh_dir"
printf '%s\n' "$SSH_PRIVATE_KEY" > "$ssh_dir/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/key" "$ssh_dir/known_hosts"
trap 'rm -f -- "$ssh_dir/key" "$ssh_dir/known_hosts"' EXIT
opts=(-i "$ssh_dir/key" -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts" -o ConnectTimeout=20)
server="$STAGING_USER@$STAGING_HOST"
incoming="/opt/forever-hotel/.infra-release/fds-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
tar -czf "$RUNNER_TEMP/fds-release.tgz" deploy/staging/release.mjs .staging-release/release-images.json
ssh "${opts[@]}" "$server" "umask 077; mkdir -p '$incoming'"
scp "${opts[@]}" "$RUNNER_TEMP/fds-release.tgz" "$server:$incoming/bundle.tgz"
ssh "${opts[@]}" "$server" "tar -xzf '$incoming/bundle.tgz' -C '$incoming'; cd '$incoming'; node deploy/staging/release.mjs .staging-release/release-images.json '$GITHUB_SHA' /opt/forever-hotel/.infra-release/host.json"
scp "${opts[@]}" "$server:/opt/forever-hotel/.infra-release/fds-last-attempt.json" .staging-release/receipt.json
