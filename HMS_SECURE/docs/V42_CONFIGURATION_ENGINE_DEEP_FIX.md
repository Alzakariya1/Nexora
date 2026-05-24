# V42 Configuration Engine Deep Fix

## Goal
Make the Configuration section operational instead of UI-only. This phase connects dynamic fields and document templates to the real Patient/Doctor workflows and adds clear success/error notifications.

## Delivered

### Dynamic Fields
- Dynamic fields can be created, edited, toggled active/inactive, deleted and listed.
- Created fields refresh immediately in Configuration and supported forms.
- Patient form renders active patient dynamic fields.
- Doctor form renders active doctor dynamic fields.
- Custom field values are stored in `custom_fields` on Patient and Doctor records.
- Edit forms prefill saved custom field values.
- Patient/Doctor profiles show saved custom fields.
- Backend validates required dynamic fields.
- Backend validates numeric dynamic fields.
- Backend validates select/dropdown options.
- Dynamic fields remain tenant/hospital isolated using the existing tenant middleware.

### Notifications
- Added toast notifications for field create/update/delete/toggle.
- Added toast notifications for template create/update/delete/preview.
- Patient and Doctor save flows continue to show success/error notifications.
- Backend validation errors are shown clearly in the UI.

### Templates
- Template create/edit/delete already existed and now has toast feedback.
- Added template preview API.
- Added template preview UI inside Configuration.
- Preview replaces template variables such as `{{patient_name}}`, `{{doctor_name}}`, `{{hospital_name}}`, `{{invoice_number}}`, `{{total_amount}}`, `{{paid_amount}}`, `{{diagnosis}}`, `{{prescription_items}}`, and `{{report_notes}}`.

## APIs Added / Updated

### Configuration
- `GET /api/configuration/dynamic-fields`
- `GET /api/configuration/public-fields`
- `POST /api/configuration/dynamic-fields`
- `PUT /api/configuration/dynamic-fields/:id`
- `PATCH /api/configuration/dynamic-fields/:id/status`
- `DELETE /api/configuration/dynamic-fields/:id`

### Templates
- `POST /api/templates/:id/preview`

### Patient / Doctor
- Patient create/update supports `custom_fields`.
- Doctor create/update supports `custom_fields`.

## Manual QA Checklist

### Dynamic Field Test
1. Open Configuration.
2. Create a patient field:
   - Module: Patients
   - Label: ABHA ID
   - Field Key: abha_id
   - Type: Text
   - Active: Yes
3. Confirm success toast appears.
4. Confirm the field appears in Configured Fields.
5. Open Patients.
6. Confirm ABHA ID appears under Additional Details.
7. Save a patient with ABHA ID.
8. Edit that patient and confirm ABHA ID is prefilled.
9. Open patient profile and confirm ABHA ID is visible.

### Required Validation Test
1. Create a required patient field.
2. Try saving a patient without filling it.
3. Confirm the backend error is shown in toast.

### Select Options Test
1. Create a select field:
   - Label: Insurance Type
   - Options: Private, Corporate, Government, Self Pay
2. Confirm dropdown options appear in Patients.
3. Save and edit to confirm value persists.

### Doctor Custom Field Test
1. Create a doctor field:
   - Label: Medical Council Registration No.
   - Field Key: medical_council_registration_no
2. Confirm it appears in Add Doctor/Edit Doctor.
3. Save and confirm it appears in Doctor Profile.

### Template Preview Test
1. Create an invoice template.
2. Use variables like `{{patient_name}}` and `{{total_amount}}`.
3. Use the Preview action.
4. Confirm preview text renders sample values.

## Release Notes
- No `.env`, `node_modules`, or `dist` should be shipped.
- Keep `package.json`, `package-lock.json`, and `.env.example` included.
