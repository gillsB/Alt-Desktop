import fs from "fs";
import path from "path";
import winston from "winston";

// Configure the log file path
const logDir = path.join(getAppDataPath(), "logs");
const logFileName = `main_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
const logFile = path.join(logDir, logFileName);

// Ensure the logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format to include timestamp, log level, and source file
const customFormat = winston.format.printf((info) => {
  return `[${info.timestamp}] [${info.level.toUpperCase()}] [${info.file}] ${info.message}`;
});

// Create a Winston logger instance
export const baseLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  ),
  transports: [
    new winston.transports.File({
      filename: logFile,
      maxsize: 8 * 1024 * 1024, // 8MB
      maxFiles: 3, // Keep only the last 3 log files
      tailable: false, // Rotate logs by appending to the end
    }),
    new winston.transports.Console(), // Log to console as well
  ],
});

// Utility to create a logger for a specific file
export function createLoggerForFile(file: string) {
  return {
    info: (message: string) => baseLogger.info({ message, file }),
    warn: (message: string) => baseLogger.warn({ message, file }),
    error: (message: string) => baseLogger.error({ message, file }),
    debug: (message: string) => baseLogger.debug({ message, file }),
  };
}

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

    // Keep only the most recent 3 files
    if (files.length > 3) {
      files.slice(3).forEach((file) => {
        baseLogger.info(`Deleting old log file: ${file.name}`);
        fs.unlinkSync(file.path);
      });
    }
    baseLogger.info("Old log files cleaned up successfully.");
  } catch (err) {
    baseLogger.error("Error cleaning up old log files:", err);
  }
}

function getAppDataPath() {
  const appDataPath = process.env.APPDATA;
  if (!appDataPath) {
    throw new Error("APPDATA environment variable is not set.");
  }
  return path.join(appDataPath, "AltDesktop");
}

cleanupOldLogFiles();
