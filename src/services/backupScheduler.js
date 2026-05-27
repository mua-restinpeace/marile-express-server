const cron = require("node-cron");
const { runBackup } = require("./backupService");

/**
 * Start the automated backup scheduler.
 * Runs every day at 02:00 AM local time.
 *
 * Cron syntax: '0 2 * * *'
 *   ┌─ minute (0)
 *   │  ┌─ hour (2 = 2 AM)
 *   │  │  ┌─ day of month (* = every day)
 *   │  │  │  ┌─ month (* = every month)
 *   │  │  │  │  ┌─ day of week (* = every day)
 *   0  2  *  *  *
 */
function startBackupScheduler() {
  console.log("⏰ Backup scheduler started — runs daily at 02:00 AM");

  cron.schedule("0 2 * * *", async () => {
    console.log("\nScheduled backup triggerd...");
    try {
      const result = await runBackup();
      console.log(
        `✅ Scheduled backup done: ${result.filename} (${result.size_kb} KB)\n`,
      );
    } catch (err) {
      console.error(`Scheduled backup failed: ${err.message}\n`);
    }
  });
}

module.exports = { startBackupScheduler };
