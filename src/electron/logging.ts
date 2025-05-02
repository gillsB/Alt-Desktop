import fs from "fs";
import path from "path";
import winston from "winston";

// Configure the log file paths
const logDir = path.join(getAppDataPath(), "logs"); // Cannot use util function as this runs before util.
const mainLogFileName = `main_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
const videoLogFileName = `video_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
const mainLogFile = path.join(logDir, mainLogFileName);
const videoLogFile = path.join(logDir, videoLogFileName);

// Ensure the logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format to include timestamp, log level, and source file
const customFormat = winston.format.printf((info) => {
  return `[${info.timestamp}] [${info.level.toUpperCase()}] [${info.file}] ${info.message}`;
});

// Create a Winston logger instance for the main log
export const baseLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  ),
  transports: [
    new winston.transports.File({
      filename: mainLogFile,
      maxsize: 8 * 1024 * 1024, // 8MB
      maxFiles: 3, // Keep only the last 3 log files
      tailable: false, // Rotate logs by appending to the end
    }),
    new winston.transports.Console(), // Log to console as well
  ],
});

// Create a Winston logger instance for the video log
export const videoLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  ),
  transports: [
    new winston.transports.File({
      filename: videoLogFile,
      maxsize: 8 * 1024 * 1024, // 8MB
      maxFiles: 3, // Keep only the last 3 log files
      tailable: false, // Rotate logs by appending to the end
    }),
    new winston.transports.Console(), // Log to console as well
  ],
});

// Utility to create a logger for a specific file (main log)
export function createLoggerForFile(file: string) {
  const formatArgs = (...args: unknown[]): string => args.map(String).join(" ");

  return {
    info: (...args: unknown[]) =>
      baseLogger.info({ message: formatArgs(...args), file }),
    warn: (...args: unknown[]) =>
      baseLogger.warn({ message: formatArgs(...args), file }),
    error: (...args: unknown[]) =>
      baseLogger.error({ message: formatArgs(...args), file }),
    debug: (...args: unknown[]) =>
      baseLogger.debug({ message: formatArgs(...args), file }),
  };
}

// Utility to create a logger for a specific file (video log)
export function createVideoLoggerForFile(file: string) {
  const formatArgs = (...args: unknown[]): string => args.map(String).join(" ");

  return {
    info: (...args: unknown[]) =>
      videoLogger.info({ message: formatArgs(...args), file }),
    warn: (...args: unknown[]) =>
      videoLogger.warn({ message: formatArgs(...args), file }),
    error: (...args: unknown[]) =>
      videoLogger.error({ message: formatArgs(...args), file }),
    debug: (...args: unknown[]) =>
      videoLogger.debug({ message: formatArgs(...args), file }),
  };
}

function cleanupOldLogFiles() {
  try {
    const files = fs
      .readdirSync(logDir)
      .filter((file) => file.startsWith("main_") || file.startsWith("video_"))
      .map((file) => ({
        name: file,
        path: path.join(logDir, file),
        ctime: fs.statSync(path.join(logDir, file)).ctime,
      }))
      .sort((a, b) => b.ctime.getTime() - a.ctime.getTime());

    // Keep only the most recent 3 files for each type
    const mainLogs = files.filter((file) => file.name.startsWith("main_"));
    const videoLogs = files.filter((file) => file.name.startsWith("video_"));

    [...mainLogs.slice(3), ...videoLogs.slice(3)].forEach((file) => {
      baseLogger.info(`Deleting old log file: ${file.name}`);
      fs.unlinkSync(file.path);
    });

    baseLogger.info("Old log files cleaned up successfully.");
  } catch (err) {
    baseLogger.error("Error cleaning up old log files:", err);
  }
}

// Must use its own function as appDataSetup.ts is loaded after this file
function getAppDataPath() {
  const appDataPath = process.env.APPDATA;
  if (!appDataPath) {
    throw new Error("APPDATA environment variable is not set.");
  }
  return path.join(appDataPath, "AltDesktop");
}

cleanupOldLogFiles();
