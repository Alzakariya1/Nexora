# Backup and Restore Runbook

V36 adds JSON backup scripts for staging and small/medium deployments. For large production hospitals, also enable MongoDB Atlas scheduled backups.

## Create backup

```bash
cd backend
npm run backup
```

Backups are saved to `BACKUP_DIR`, default `./backups`.

## Verify latest backup

```bash
cd backend
npm run verify-backup
```

This records a verification row in the compliance backup verification collection.

## Restore in staging

Never restore directly into production without a maintenance window and a fresh backup.

```bash
cd backend
RESTORE_CONFIRMATION=I_UNDERSTAND_RESTORE_OVERWRITES_DATA npm run restore -- ./backups/hms-backup-file.json
npm run verify-backup
npm run health
```

## Recommended production schedule

- Atlas automated backup: daily
- HMS JSON backup: daily or before major migration
- Restore drill: monthly in staging
- Backup retention: at least 14 days for app exports, longer in Atlas
