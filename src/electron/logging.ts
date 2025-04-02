import log from "electron-log";
import fs from "fs";
import path from "path";
import { getAppDataPath } from "./appDataSetup.js";

// Configure the log file path
const logDir = path.join(getAppDataPath(), "logs");
const logFileName = `main_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
const logFile = path.join(logDir, logFileName);

// Ensure the logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configure electron-log to use the specified log file
log.transports.file.resolvePathFn = () => logFile;

// Set the maximum log file size (e.g., 8MB)
log.transports.file.maxSize = 8 * 1024 * 1024; // 8MB

// Set the log format
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

// Keep only the last 3 log files
function cleanupOldLogFiles() {
  try {
    const files = fs
      .readdirSync(logDir)
      .filter((file) => file.startsWith("main_") && file.endsWith(".log"))
      .map((file) => ({
        name: file,
        path: path.join(logDir, file),
        ctime: fs.statSync(path.join(logDir, file)).ctime,
      }))
      .sort((a, b) => b.ctime.getTime() - a.ctime.getTime());

    // Keep only the most recent 3 files + the current log file
    if (files.length > 3) {
      files.slice(3).forEach((file) => {
        fs.unlinkSync(file.path);
      });
    }
  } catch (err) {
    log.error("Error cleaning up old log files:", err);
  }
}

// Run cleanup on startup
cleanupOldLogFiles();

// Additional electron-log configuration
log.transports.console.level = "info";
log.transports.file.level = "info";

// Test if electron-log is writing to the log file
log.info("Logging initialized. Logs will be saved to:", logFile);

export default log;
