# 🗄️ Database Backup & Restore — Marile

## Overview

Marile uses **mysqldump** for database backups. Backups are plain `.sql` files stored in the `server/backups/` folder. The system supports:

- **Automated daily backups** at 02:00 AM (via node-cron, runs while the server is up)
- **Manual backups** via API or script
- **Restore** from any saved backup file

Up to **7 backup files** are kept. When a new backup is created and the count exceeds 7, the oldest file is automatically deleted.

---

## Backup File Location

```
server/
└── backups/
    ├── backup-20250509-0200.sql   ← oldest
    ├── backup-20250510-0200.sql
    ├── ...
    └── backup-20250515-0200.sql   ← newest
```

Backup filenames follow the format: `backup-YYYYMMDD-HHMM.sql`

> ⚠️ The `backups/` folder is in `.gitignore` — backup files are never committed to git.

---

## Prerequisites

`mysqldump` and `mysql` must be available in your system PATH.

**Laragon** already includes them. To verify, open a terminal and run:

```bash
mysqldump --version
mysql --version
```

If you get "command not found", add Laragon's MySQL bin folder to your PATH:
```
C:\laragon\bin\mysql\mysql-8.0-winx64\bin
```

---

## Automated Backup

The scheduler starts automatically when the server boots. No configuration needed.

**Schedule:** Every day at **02:00 AM** local time.

To change the schedule, edit `src/services/backupScheduler.js`:

```js
// Current: 02:00 AM daily
cron.schedule('0 2 * * *', ...);

// Examples:
// Every 12 hours:     '0 */12 * * *'
// Every day at 11 PM: '0 23 * * *'
// Every Sunday 3 AM:  '0 3 * * 0'
```

> **Note:** Automated backups only run while the Node.js server is running.
> If the server is offline at 02:00 AM, that day's backup is skipped.
> Use the manual backup API or script after restarting the server if needed.

---

## Manual Backup

### Option 1 — Script (run from the `server/` directory)

```bash
# Windows
scripts\backup.bat
```

**Output:**
```
[Marile Backup] Starting backup...
[Marile Backup] Database : marile_db
[Marile Backup] Output   : backups\backup-20250509-1430.sql

[Marile Backup] ✅ Backup complete: backups\backup-20250509-1430.sql
```

### Option 2 — Raw mysqldump command

```bash
mysqldump --host=localhost --port=3306 --user=root --password="" \
  --single-transaction --routines --triggers --add-drop-table \
  marile_db > backups/backup-manual.sql
```

---

## List Available Backups

### Via folder

Open `server/backups/` in File Explorer.

---

## Restore

> ⚠️ **Restore overwrites the entire current database.** All data since the backup was taken will be lost. Always take a fresh backup before restoring.


### Option 1 — Script (run from the `server/` directory)

```bash
# Windows — pass the backup filename as argument
scripts\restore.bat backups\backup-20250509-0200.sql
```

**Output:**
```
[Marile Restore] ⚠️  WARNING: This will OVERWRITE the current database!
[Marile Restore] Database : marile_db
[Marile Restore] From     : backups\backup-20250509-0200.sql

Type YES to confirm restore: YES

[Marile Restore] Starting restore...
[Marile Restore] ✅ Restore complete from: backups\backup-20250509-0200.sql
```

### Option 2 — Raw mysql command

```bash
mysql --host=localhost --port=3306 --user=root --password="" \
  marile_db < backups/backup-20250509-0200.sql
```

---

## Including Uploaded Images in Backups

The automated backup only covers the **database**. Product images stored in `uploads/` are not included. To back up images manually, copy the `uploads/` folder:

```bash
# Windows — copy uploads folder to a safe location
xcopy /E /I server\uploads D:\my-backups\marile-uploads-%date%
```

For a complete backup of both database and images, run both the backup script and this copy command.

---
