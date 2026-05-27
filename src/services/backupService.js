const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const util = require("util");
const { success } = require("../utils/response");

const execAsync = util.promisify(exec);

// config
const BACKUP_DIR = path.join(__dirname, "../../backups");
const MAX_BACKUPS = 7;
const DB_HOST = process.env.DATABASE_HOST || "localhost";
const DB_PORT = process.env.DATABASE_PORT || "3306";
const DB_USER = process.env.DATABASE_USER || "root";
const DB_PASSWORD = process.env.DATABASE_PASSWORD || "";
const DB_NAME = process.env.DATABASE_NAME || "marile_db";

/**
 * Helpers: ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Backup directory created at ${BACKUP_DIR}`);
  }
}

/**
 * Helpers: generate a timestamped backup filename
 */
function generateFilename() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `backup-${yyyy}${mm}${dd}-${hh}${min}.sql`;
}

/**
 * Helpers: delete oldest backups if count exceeds MAX_BACKUPS
 * keep the newest MAX_BACKUPS files
 */
function rotateBackups() {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sql"))
    .map((f) => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      created: fs.statSync(path.join(BACKUP_DIR, f)).birthtimeMs,
    }))
    .sort((a, b) => a.created - b.created);

  const toDelete = files.slice(0, Math.max(0, files.length - MAX_BACKUPS));

  for (const file of toDelete) {
    fs.unlinkSync(file.path);
    console.log(`🗑️  Old backup deleted: ${file.name}`);
  }
}

/**
 * Helper: build the mysqldump command string
 */
function buildDumpCommand(outputPath) {
  const passFlag = DB_PASSWORD
    ? `--password="${DB_PASSWORD}"`
    : '--password=""';
  return [
    'mysqldump',
    `--host=${DB_HOST}`,
    `--port=${DB_PORT}`,
    `--user=${DB_USER}`,
    passFlag,
    "--single-transaction", // consistent snapshot without locking tables
    "--routines", // include stored procedures
    "--triggers", // include triggers
    "--add-drop-table", // drop table before create. safe to restore
    DB_NAME,
    `> "${outputPath}"`,
  ].join(" ");
}

/**
 * Helper: build the mysql restore command string
 */
function buildRestoreCommand(inputPath) {
  const passFlag = DB_PASSWORD
    ? `--password="${DB_PASSWORD}"`
    : '--password=""';
  return [
    "mysql",
    `--host=${DB_HOST}`,
    `--port=${DB_PORT}`,
    `--user=${DB_USER}`,
    passFlag,
    DB_NAME,
    `< "${inputPath}"`,
  ].join(" ");
}

/**
 * Run a database backup
 * creates a .sql dump file, then rotates old backups
 * returns the backup file path on success
 */
async function runBackup() {
  ensureBackupDir();

  const filename = generateFilename();
  const outputPath = path.join(BACKUP_DIR, filename);

  console.log(`💾 Starting backup: ${filename}`);

  try {
    const command = buildDumpCommand(outputPath);
    await execAsync(command);

    const stats = fs.statSync(outputPath);
    const sizeKb = (stats.size / 1024).toFixed(1);

    console.log(`✅ Backup complete: ${filename} (${sizeKb} KB)`);

    rotateBackups();

    return {
      success: true,
      filename,
      path: outputPath,
      size_kb: parseFloat(sizeKb),
      created: new Date().toISOString(),
    };
  } catch (err) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    console.error("❌ Backup failed: ", err.message);
    throw new Error(`Backup failed: ${err.message}`);
  }
}

/**
 * Restore database from a specific backup file.
 * @param {string} filename — just the filename, e.g. 'backup-20250509-1400.sql'
 */
async function runRestore(filename) {
  const inputPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Backup file not found: ${filename}`);
  }

  const resolved = path.resolve(inputPath);
  if (!resolved.startsWith(path.resolve(BACKUP_DIR))) {
    throw new Error("Invalid backup file path");
  }

  console.log(`🔄 Starting restore from: ${filename}`);

  try {
    const command = buildRestoreCommand(inputPath);
    await execAsync(command);
    console.log(`✅ Restore complete from: ${filename}`);
    return {
      success: true,
      filename,
      restore_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Restore failed: ", err.message);
    throw new Error(`Restore failed: ${err.message}`);
  }
}

/**
 * List all available backup files with metadata
 */
function listBackups() {
  ensureBackupDir();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sql"))
    .map((f) => {
      const filePath = path.join(BACKUP_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        filename: f,
        size_kn: parseFloat((stats.size / 1024).toFixed(1)),
        created_at: stats.birthtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return files;
}

module.exports = { runBackup, runRestore, listBackups, BACKUP_DIR };
