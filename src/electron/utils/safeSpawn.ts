import { spawn } from "child_process";
import { shell } from "electron";
import fs from "fs";
import { createLoggerForFile } from "../logging.js";

const logger = createLoggerForFile("safeSpawn.ts");

export function safeSpawn(
  executablePath: string,
  args: string[] = []
): boolean {
  try {
    if (!fs.existsSync(executablePath)) {
      logger.warn(`File does not exist: ${executablePath}`);
      return false;
    }

    // Validate args
    if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
      logger.warn(`Invalid args provided for ${executablePath}`);
      return false;
    }

    logger.info(`Launching ${executablePath} ${args.join(" ")}`);

    // Handle .lnk files differently (Windows shortcuts)
    if (executablePath.toLowerCase().endsWith(".lnk")) {
      shell.openPath(executablePath);
      return true;
    }

    // Otherwise spawn directly
    spawn(executablePath, args, {
      detached: true,
      stdio: "ignore",
    }).unref();

    return true;
  } catch (err) {
    logger.error(`Failed to launch ${executablePath} - ${err}`);
    return false;
  }
}
