@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: Marile Database Restore Script (Windows)
:: Usage: scripts\restore.bat backups\backup-20250509-1400.sql
:: ─────────────────────────────────────────────────────────────────────────────

if "%1"=="" (
  echo Usage: scripts\restore.bat backups\backup-YYYYMMDD-HHMM.sql
  echo.
  echo Available backups:
  dir /b backups\backup-*.sql 2>nul
  exit /b 1
)

set BACKUP_FILE=%1

if not exist "%BACKUP_FILE%" (
  echo File not found: %BACKUP_FILE%
  exit /b 1
)

:: Load .env values
for /f "tokens=1,2 delims==" %%A in (.env) do (
  if "%%A"=="DATABASE_HOST"     set DB_HOST=%%B
  if "%%A"=="DATABASE_PORT"     set DB_PORT=%%B
  if "%%A"=="DATABASE_USER"     set DB_USER=%%B
  if "%%A"=="DATABASE_PASSWORD" set DB_PASS=%%B
  if "%%A"=="DATABASE_NAME"     set DB_NAME=%%B
)

if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USER%"=="" set DB_USER=root
if "%DB_NAME%"=="" set DB_NAME=marile_db

echo.
echo [Marile Restore] WARNING: This will OVERWRITE the current database!
echo [Marile Restore] Database : %DB_NAME%
echo [Marile Restore] From     : %BACKUP_FILE%
echo.
set /p CONFIRM="Type YES to confirm restore: "

if /i not "%CONFIRM%"=="YES" (
  echo [Marile Restore] Restore cancelled.
  exit /b 0
)

echo.
echo [Marile Restore] Starting restore...

mysql --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% --password="%DB_PASS%" ^
  %DB_NAME% < "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
  echo [Marile Restore] Restore complete from: %BACKUP_FILE%
) else (
  echo [Marile Restore] Restore FAILED. Check MySQL connection and file integrity.
)
echo.
