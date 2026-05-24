# E2E Testing

Phase 8C E2E testing verifies the full HMS workflow contract across frontend API calls and backend route coverage.

## Commands

Backend:

```bash
cd backend
npm run check:phase8c-e2e
```

Frontend:

```bash
cd frontend
npm run test:e2e
```

## Critical Journeys

- Login and token persistence.
- Add patient and update patient.
- Book appointment and update appointment status.
- Save OPD/EMR clinical record.
- Create billing invoice and payment update.
- Create lab order, enter results and approve/verify reports.
- Admit IPD patient, add nursing notes and discharge.
- Pharmacy stock and sale workflow.
- Patient portal self-service access.
- Doctor portal assigned queue and clinical worklist.
