# DDP-203 — W04-B Real FDS-to-WKMS Manual Assignment

Executed: 2026-10-27T14:19:44.155Z
Pinned WKMS commit: 3dd561cf3dab9115927f827efe36227684e950b6
Environment: isolated Plan 03 Docker PostgreSQL front_desk_test on 127.0.0.1:55434; local FDS 4306, WKMS 4406.
RabbitMQ disabled in this targeted REST integration run. No Neon connections or original .env changes.
A synthetic FRONT_DESK task and resulting audit events are retained in the disposable database for inspection.
Synthetic task ID: edec027a-c4e8-4332-a214-f48e5955cc6a

**Results: 6 PASS, 0 FAIL, 2 BLOCKED.**

- **PASS** W04B-01: WKMS manual assignment rejects missing or incorrect service credentials — Both missing and invalid inter-service bearer credentials rejected with 401
- **PASS** W04B-02: FDS rejects unauthenticated receptionist assignment — Unauthenticated FDS assignment returned HTTP 401
- **PASS** W04B-03: FDS rejects non-receptionist manual assignment — JWT MANAGER principal denied the FDS receptionist-only write operation (403)
- **PASS** W04B-04: Actual FDS -> WKMS authenticated HTTP assignment returns normalized contract — FDS HTTP 201; normalized taskId/assignedWorkerId/status=ASSIGNED from live WKMS DDP-198
- **PASS** W04B-05: WKMS task ownership and both WKMS/FDS audit entries persist — One WKMS task transition audit and one FDS receptionist assignment audit; DB status ASSIGNED
- **PASS** W04B-06: WKMS rejects repeated assignment without changing ownership or duplicating audits — Repeated assignment rejected (FDS HTTP 502); ownership and original two audits unchanged
- **BLOCKED** W04B-07: FDS creates a new WKMS service-request task — WKMS has not published the expected authenticated service-task creation API
- **BLOCKED** W04B-08: FDS retrieves WKMS available workers — WKMS has not published the expected authenticated worker discovery API

## Scope and limitations
- These checks exercise the actual HTTP servers, FDS adapter, WKMS controller, PostgreSQL task persistence and both audit records.
- WKMS DDP-198 assignment is tested against one synthetic task/worker; it does not validate task creation or worker availability APIs.
- WKMS internal service-task creation and available-worker discovery remain BLOCKED, not passed.
- Repeated assignment may be rejected to FDS as HTTP 502 because the current generic adapter maps upstream HTTP 409 to Bad Gateway; track status mapping separately if this occurs.
- The FDS and WKMS credentials, JWT and test database passwords are never included in reports.
- This is a local disposable integration environment, not a production deployment or central-auth acceptance test.
