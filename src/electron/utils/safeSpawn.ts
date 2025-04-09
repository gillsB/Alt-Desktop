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

    // TODO add a setting to ignore These two checks for advanced users to use at their own risk.
    // This blocks any args with characters that could be used for command injection
    const suspiciousChars = /[;&|><$]/;
    if (args.some((arg) => suspiciousChars.test(arg))) {
      logger.warn(
        `safeSpawn: Suspicious characters in args for ${executablePath}`
      );
      return false;
    }

    // Block common system executables that could cause harm
    const blockedExecutables = [
      "cmd.exe",
      "powershell.exe",
      "shutdown.exe",
      "regedit.exe",
      "taskkill.exe",
      "format.com",
    ];

    if (
      blockedExecutables.some((bad) =>
        executablePath.toLowerCase().endsWith(bad)
      )
    ) {
      logger.warn(`safeSpawn: Blocked executable ${executablePath}`);
      return false;
    }

    logger.info(`Launching ${executablePath} ${args.join(" ")}`);

    // Handle .lnk files differently (Windows shortcuts)
    if (executablePath.toLowerCase().endsWith(".lnk")) {
      shell.openPath(executablePath);
      return true;
    }

    // Handle non-executable files (e.g., .mp4, .txt, etc.)
    const fileExtension = executablePath.split(".").pop()?.toLowerCase();
    if (fileExtension && fileExtension !== "exe") {
      logger.info(
        `Launching non-executable file with default program: ${executablePath}`
      );
      shell.openPath(executablePath);
      return true;
    }

    // Otherwise, spawn executables directly
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
