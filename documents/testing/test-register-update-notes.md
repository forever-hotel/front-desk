# FDS Test Register - Update Notes (27 October 2026)

The original detailed 43-case `test-register-source.csv` remains untouched. Updated `test-register.pdf` preserves all 43 original IDs and their CI-versus-live-integration qualifications, then adds later local acceptance summaries. New performance evidence is separately recorded in `performance-execution-register.csv` in the evidence directory.

* Phase B: actual WKMS checkout consumer and escalation outbox (3 pass, 3 blocked).
* Phase C: disposable RabbitMQ restart/recovery (5 pass, 3 blocked).
* Phase D: development browser realtime UX, fallback/reconnect (8 pass).
* W04-B: local authenticated FDS-to-WKMS assignment (6 pass, 2 blocked).

Original FD-18/FD-19 cases are not automatically marked as completed production cross-system end-to-end flows. Central Auth and public HTTPS staging remain unverified.
