# Phase 4 Stabilization Notes

Focus: Appointment queue workflow hardening.

Changes included:
- Added strict appointment status transition rules on backend.
- Blocked invalid jumps such as completed -> checked_in or cancelled -> in_consultation.
- Enforced one active `in_consultation` appointment per doctor per day.
- Added queue-safe status timestamps for check-in, consultation start, completion, cancellation.
- Improved appointment list sorting by date + token sequence instead of unstable UI ordering.
- Added repair script to normalize old invalid statuses and move duplicate active consultations back to checked-in.

After deployment, run once from backend:

```bash
npm run phase4:appointment-workflow
```

Then redeploy/restart backend and frontend.
