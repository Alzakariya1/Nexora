# Phase 1E Pharmacy Module Report

## Baseline
Started from `V48_phase1D_billing_module.zip` and preserved the existing Phase 0–1D functionality.

## Implemented
- Added stronger medicine validation for required name, non-negative quantity/stock/prices, and valid expiry date.
- Added duplicate protection for active medicines using medicine name + batch number.
- Added pharmacy audit logs for:
  - medicine create
  - medicine update
  - medicine archive
  - stock adjustment
  - direct sale
  - prescription dispense
- Added safe soft archive for medicines instead of permanent delete.
- Added active medicine filtering so archived medicines are hidden from normal medicine, low-stock, and summary screens.
- Improved sale validation for medicine ID, quantity, and selling price.
- Kept stock reduction safety: sale and prescription dispense fail if stock is insufficient.
- Preserved low-stock notifications after stock adjustment, sale, and prescription dispense.
- Added frontend archive action for medicines with reason prompt.
- Improved recent pharmacy sales table to show cleaner sales columns.
- Added API client support for medicine archive.

## Files Changed
- `backend/src/routes/pharmacy.routes.js`
- `frontend/src/api/pharmacyApi.js`
- `frontend/src/pages/Pharmacy.jsx`

## Regression / Build Checks
- Backend syntax check: passed
- Backend route loading: passed
- QA smoke: passed, 283 routes loaded
- Frontend production build: passed

## Notes
- Frontend build still shows the existing large bundle warning. It does not break build, but later phases should add route-level code splitting.
- Pharmacy now has a safer foundation for the later advanced phase: batch-wise dispensing, FEFO, purchase order/GRN connection, returns, and controlled drug register.
