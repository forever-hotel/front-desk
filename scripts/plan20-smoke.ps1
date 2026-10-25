# Plan 20 - safe, read-only local infrastructure smoke test.
# No credentials, JWTs, database writes, or destructive requests.
[CmdletBinding()]
param(
    [string]$GatewayBase = 'http://127.0.0.1:8080',
    [string]$BackendBase = 'http://127.0.0.1:4200',
    [string]$FrontendBase = 'http://127.0.0.1:3100',
    [string]$RabbitContainer = 'forever-rabbitmq',
    [string]$EvidencePath = '.\evidence\plan20-local-smoke.json'
)

$ErrorActionPreference = 'Stop'

function Get-HttpStatusCode {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 12 -ErrorAction Stop
        return [int]$response.StatusCode
    }
    catch {
        $httpResponse = $_.Exception.Response
        if ($null -ne $httpResponse) {
            return [int]$httpResponse.StatusCode
        }
        return 0
    }
}

$checks = @(
    [pscustomobject]@{ name = 'Docker frontend HTTP'; url = "$FrontendBase/"; expected = 200 },
    [pscustomobject]@{ name = 'Docker backend readiness'; url = "$BackendBase/health/ready"; expected = 200 },
    [pscustomobject]@{ name = 'Gateway forwarded readiness'; url = "$GatewayBase/fds/health/ready"; expected = 200 },
    [pscustomobject]@{ name = 'Gateway rejects unauthenticated rooms'; url = "$GatewayBase/fds/rooms/status"; expected = 401 }
)

$results = @()
foreach ($check in $checks) {
    $actual = Get-HttpStatusCode -Url $check.url
    $passed = ($actual -eq $check.expected)
    $results += [pscustomobject]@{
        check = $check.name
        url = $check.url
        expected_status = $check.expected
        actual_status = $actual
        passed = $passed
    }
    $statusLabel = if ($passed) { 'PASS' } else { 'FAIL' }
    Write-Host ("{0}: {1} (actual {2}; expected {3})" -f $check.name, $statusLabel, $actual, $check.expected)
}

$rabbitPing = $false
$rabbitDetail = 'Docker CLI unavailable or RabbitMQ ping failed'
try {
    $output = @(& docker exec $RabbitContainer rabbitmq-diagnostics -q ping 2>&1)
    $exitCode = $LASTEXITCODE
    $rabbitPing = ($exitCode -eq 0)
    $rabbitDetail = if ($rabbitPing) { 'RabbitMQ broker responds to diagnostics ping' } else { 'RabbitMQ ping returned a nonzero exit code' }
}
catch {
    $rabbitDetail = 'RabbitMQ ping command could not be executed'
}
Write-Host ("RabbitMQ broker ping: {0}" -f $(if ($rabbitPing) { 'PASS' } else { 'FAIL' }))

$results += [pscustomobject]@{
    check = 'RabbitMQ broker ping'
    url = 'docker exec (local broker)'
    expected_status = 'success'
    actual_status = if ($rabbitPing) { 'success' } else { 'failure' }
    passed = $rabbitPing
}

$allPassed = (@($results | Where-Object { -not $_.passed }).Count -eq 0)
$report = [ordered]@{
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    branch = 'feature/70-fds-auth-integration (verify via git before attaching)'
    scope = 'Read-only local smoke only, not public staging or full auth/E2E proof'
    checks = $results
    passed = $allPassed
    unverified = @(
        'Central Auth live login/session/logout'
        'Authenticated Socket.IO with real Central Auth credentials'
        'FDS RabbitMQ publish/consume workflow (broker ping alone does not prove integration)'
        'Public HTTPS staging and real cross-subsystem workflows'
    )
}

$outputFile = if ([System.IO.Path]::IsPathRooted($EvidencePath)) {
    $EvidencePath
} else {
    Join-Path (Get-Location).Path $EvidencePath
}
$folder = Split-Path -Parent $outputFile
if (-not (Test-Path -LiteralPath $folder)) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}
$report | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $outputFile -Encoding UTF8
Write-Host "Saved read-only test results to: $outputFile"
if (-not $allPassed) { exit 1 }
