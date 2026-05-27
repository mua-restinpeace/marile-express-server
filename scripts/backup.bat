@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: Marile Database Backup Script (Windows)
:: Usage: scripts\backup.bat
:: ─────────────────────────────────────────────────────────────────────────────

:: Load .env values — reads DATABASE_* variables from server\.env
for /f "tokens=1,2 delims==" %%A in (.env) do (
  if "%%A"=="DATABASE_HOST"     set DB_HOST=%%B
  if "%%A"=="DATABASE_PORT"     set DB_PORT=%%B
  if "%%A"=="DATABASE_USER"     set DB_USER=%%B
  if "%%A"=="DATABASE_PASSWORD" set DB_PASS=%%B
  if "%%A"=="DATABASE_NAME"     set DB_NAME=%%B
)

:: Fallback defaults
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USER%"=="" set DB_USER=root
if "%DB_NAME%"=="" set DB_NAME=marile_db
if "%DB_PASS%"=="" set DB_PASS=

:: Generate timestamp for filename
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set DATE_STR=%%c%%b%%a
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME_STR=%%a%%b
set FILENAME=backup-%DATE_STR%-%TIME_STR%.sql

:: Ensure backup directory exists
if not exist "backups" mkdir backups

echo.
echo [Marile Backup] Starting backup...
echo [Marile Backup] Database : %DB_NAME%
echo [Marile Backup] Output   : backups\%FILENAME%
echo.

:: Run mysqldump
mysqldump --host=%DB_HOST% --port=%DB_PORT% --user=%DB_USER% --password="%DB_PASS%" ^
  --single-transaction --routines --triggers --add-drop-table ^
  %DB_NAME% > "backups\%FILENAME%"

if %ERRORLEVEL% EQU 0 (
  echo [Marile Backup] Backup complete: backups\%FILENAME%
) else (
  echo [Marile Backup] Backup FAILED. Check that mysqldump is in your PATH.
  del "backups\%FILENAME%" 2>nul
)
echo.
